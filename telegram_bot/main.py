# main.py
# -*- coding: utf-8 -*-

import os
import logging
import uuid
import random
import string
from datetime import datetime, timedelta, timezone
import magic # Detect mime types
import requests # For Ollama HTTP requests and Mailgun API calls
import json # For parsing Ollama response more reliably
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    ConversationHandler,
    CallbackQueryHandler # Included, though not used in current logic
)
from supabase import create_client, Client
import openai # Using openai lib structure for Whisper
from dateutil.parser import isoparse # For parsing iso string from DB

# --- Configuration & Initialization ---
load_dotenv() # Load variables from .env file

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO # Change to logging.DEBUG for more verbose output
)
# Suppress overly verbose logs from underlying HTTP libraries if desired
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# --- Environment Variables ---
TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # Use Service Key for admin actions
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-coder:6.7b") # Or your preferred model
MAILGUN_API_KEY = os.getenv("MAILGUN_API_KEY")
MAILGUN_DOMAIN = os.getenv("MAILGUN_DOMAIN")
MAILGUN_FROM_EMAIL = os.getenv("MAILGUN_FROM_EMAIL")
# Use Mailgun's base URL directly (adjust if using EU region)
MAILGUN_API_BASE_URL = os.getenv("MAILGUN_API_URL", "https://api.mailgun.net/v3")

# Whisper Config (Ensure API Key or Base URL is set if using OpenAI API)
openai.api_key = os.getenv("OPENAI_API_KEY")
if os.getenv("WHISPER_API_BASE"):
    openai.api_base = os.getenv("WHISPER_API_BASE")
# Add checks later if Whisper API key/base is strictly required

# --- Supabase Client ---
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}", exc_info=True)
else:
    logger.error("Supabase URL or Key missing in environment variables.")

# --- Mailgun Configuration Check ---
mailgun_configured = bool(MAILGUN_API_KEY and MAILGUN_DOMAIN and MAILGUN_FROM_EMAIL)
if not mailgun_configured:
    logger.warning("Mailgun API Key, Domain, or From Email missing. Email sending disabled.")


# --- Conversation Handler States ---
ASK_EMAIL, ASK_CODE = range(2)

# --- Helper Functions ---

# --- Linking Helpers ---
async def get_profile_by_telegram_id(telegram_id: int) -> dict | None:
    """Fetches profile using telegram_id."""
    if not supabase: return None
    try:
        # Select id (Supabase UUID) and email for confirmation message
        res = supabase.table("profiles").select("id, telegram_id, email").eq("telegram_id", telegram_id).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error fetching profile by telegram_id {telegram_id}: {e}", exc_info=True)
        return None

async def get_user_uuid_by_email(email: str) -> str | None:
    """Finds Supabase user UUID by looking up the email in the public.profiles table."""
    if not supabase: return None
    try:
        # Query the public.profiles table (no schema needed)
        # Match email case-insensitively
        res = supabase.table("profiles").select("id").ilike("email", email.strip().lower()).limit(1).execute() # Use ilike for case-insensitive

        if res.data:
            logger.info(f"Found profile via email {email}: {res.data[0]['id']}")
            return res.data[0]['id'] # The 'id' column IS the Supabase User UUID
        else:
            logger.warning(f"Could not find profile for email {email}.")
            return None
    except Exception as e:
        logger.error(f"Error fetching profile UUID by email {email}: {e}", exc_info=True)
        return None


async def store_link_code(supabase_user_uuid: str, telegram_id: int, code: str) -> bool:
    """Stores the link code and expiry in the user's profile using upsert."""
    if not supabase: return False
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10) # 10 minute expiry
        # Upsert ensures profile row exists or updates existing one
        # It matches on 'id' (PK) and updates the other fields
        res = supabase.table("profiles").upsert({
            "id": supabase_user_uuid, # Match on primary key
            "link_code": code,
            "link_code_expires_at": expires_at.isoformat(),
            "telegram_id": None # Clear previous link during new link process for THIS user
        }, on_conflict="id").execute() # Conflict on the user UUID (PK)

        if res.data:
             logger.info(f"Stored/Updated link code for Supabase user {supabase_user_uuid}")
             # Also clear the code from any *other* user who might have had this telegram_id pending
             # This prevents linking wrong account if user starts linking with two emails/accounts
             # for the same telegram ID before completing one.
             supabase.table("profiles").update({
                 "link_code": None,
                 "link_code_expires_at": None
             }).eq("telegram_id", telegram_id).neq("id", supabase_user_uuid).execute()
             return True
        else:
             # Upsert in v1 might not return data on success consistently, check for errors instead
             # A lack of data might also mean the profile didn't exist and upsert couldn't insert? Check DB schema.
             # Let's assume for now lack of error means success. Need testing.
             logger.warning(f"Upsert for link code might have failed or returned no data for Supabase user {supabase_user_uuid}.")
             # Let's assume success if no explicit error was raised by the client library
             # Revisit this if linking fails consistently.
             return True # Tentative: Assume success if no exception
    except Exception as e:
        logger.error(f"Error storing link code for user {supabase_user_uuid}: {e}", exc_info=True)
        return False

async def verify_link_code(telegram_id: int, code_attempt: str) -> str | None:
    """Verifies code, links account if valid, returns Supabase UUID or 'ALREADY_LINKED_OTHER' or None."""
    if not supabase: return None
    try:
        # Find profile by the CODE
        res = supabase.table("profiles").select("id, link_code_expires_at, telegram_id").eq("link_code", code_attempt).limit(1).execute()

        if not res.data:
            logger.warning(f"Link code attempt failed for telegram_id {telegram_id}: Code '{code_attempt}' not found.")
            return None

        profile = res.data[0]
        supabase_user_uuid = profile['id']
        expires_at_str = profile['link_code_expires_at']
        current_linked_telegram_id = profile.get('telegram_id') # Get currently linked ID for this profile

        # Check if the profile found via code is already linked to a *different* Telegram ID
        if current_linked_telegram_id and current_linked_telegram_id != telegram_id:
             logger.warning(f"Code {code_attempt} belongs to user {supabase_user_uuid} but they are already linked to Telegram ID {current_linked_telegram_id}.")
             # Don't clear the code here, the other user might still need it? Or maybe clear it? Risky.
             # Best to just report the error.
             return "ALREADY_LINKED_OTHER" # Indicate the target Supabase account is linked elsewhere

        # Check expiry
        if not expires_at_str or isoparse(expires_at_str) < datetime.now(timezone.utc):
            logger.warning(f"Link code attempt failed for telegram_id {telegram_id}: Code expired.")
            # Clear expired code
            supabase.table("profiles").update({"link_code": None, "link_code_expires_at": None}).eq("id", supabase_user_uuid).eq("link_code", code_attempt).execute()
            return None

        # Code is valid, not expired, and target profile is either not linked or linked to current telegram user
        # Proceed to link
        update_res = supabase.table("profiles").update({
            "telegram_id": telegram_id,
            "link_code": None,
            "link_code_expires_at": None
        }).eq("id", supabase_user_uuid).execute()

        if update_res.data:
            logger.info(f"Successfully linked Telegram ID {telegram_id} to Supabase User {supabase_user_uuid}")
            return supabase_user_uuid
        else:
            logger.error(f"Failed to update profile during final link step for Telegram ID {telegram_id} to Supabase User {supabase_user_uuid}")
            # This would be an unexpected DB error
            return None

    except Exception as e:
        logger.error(f"Error verifying link code for telegram_id {telegram_id}: {e}", exc_info=True)
        return None

def generate_link_code(length=6):
    """Generates a random numeric code."""
    return "".join(random.choices(string.digits, k=length))

async def send_link_code_email(to_email: str, code: str) -> bool:
    """Sends the linking code via Mailgun using requests."""
    if not mailgun_configured:
         logger.error('Mailgun not configured for sending link code.')
         return False

    logger.info(f"Attempting to send link code email to {to_email} via Mailgun.")
    subject = "Your LiquidLM Telegram Bot Linking Code"
    htmlBody = f"""
    <p>Hello,</p>
    <p>Use the following code in the Telegram chat to link your account to LiquidLM:</p>
    <p style="font-size: 1.5em; font-weight: bold; margin: 15px 0; letter-spacing: 2px;">{code}</p>
    <p>This code will expire in 10 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
    <p>Thanks,<br/>The LiquidLM Team</p>
    """
    api_endpoint = f"{MAILGUN_API_BASE_URL}/{MAILGUN_DOMAIN}/messages"
    auth_tuple = ("api", MAILGUN_API_KEY)
    data = { "from": MAILGUN_FROM_EMAIL, "to": [to_email], "subject": subject, "html": htmlBody }

    try:
        response = requests.post(api_endpoint, auth=auth_tuple, data=data, timeout=20) # Increased timeout slightly
        response.raise_for_status()
        logger.info(f"Link code email sent via Mailgun to {to_email}. Status: {response.status_code}, ID: {response.json().get('id')}")
        return True
    except requests.exceptions.RequestException as e:
        logger.error(f"Mailgun API request failed for {to_email}: {e}", exc_info=False) # Keep log concise
        if e.response is not None: logger.error(f"Mailgun error response: {e.response.text}")
        return False
    except Exception as e:
         logger.error(f"Unexpected error during Mailgun request for {to_email}: {e}", exc_info=True)
         return False

# --- Central Auth Check ---
async def get_supabase_uuid(update: Update, context: ContextTypes.DEFAULT_TYPE) -> str | None:
    """Checks if user is linked and returns Supabase UUID, prompts to link if not."""
    if not update.effective_user:
        logger.warning("Cannot get effective_user from update.")
        return None
    telegram_id = update.effective_user.id

    profile = await get_profile_by_telegram_id(telegram_id)
    if profile and profile.get('id'):
        logger.debug(f"User {telegram_id} is linked to Supabase ID {profile['id']}")
        return profile['id'] # Return the Supabase UUID
    else:
        logger.info(f"User {telegram_id} is not linked. Prompting.")
        # Avoid sending message if the original update wasn't a message (e.g., callback query)
        if update.message:
            await update.message.reply_text("Your Telegram account isn't linked to LiquidLM yet. Please use /link first.")
        return None

# --- Core Logic Helpers ---
async def transcribe_audio(audio_file_path: str) -> str | None:
    """Transcribes audio using Whisper."""
    logger.info(f"Transcribing audio file: {audio_file_path}")
    # Check if Whisper is configured (example)
    # if not openai.api_key and not openai.api_base:
    #     logger.error("Whisper Error: OpenAI API Key or Base URL not configured.")
    #     return None # Or implement local library call

    try:
        with open(audio_file_path, "rb") as audio_file:
            response = await openai.Audio.atranscribe("whisper-1", audio_file) # Requires openai v1+
            transcription = response.text # Access the 'text' attribute directly in v1+
            logger.info(f"Whisper Transcription successful: {transcription[:50]}...")
            return transcription
    except Exception as e:
        logger.error(f"Error during Whisper transcription: {e}", exc_info=True)
        return None
    finally:
        if os.path.exists(audio_file_path):
            try:
                os.remove(audio_file_path)
                logger.info(f"Cleaned up audio file: {audio_file_path}")
            except OSError as e:
                logger.error(f"Error removing audio file {audio_file_path}: {e}")

async def fetch_task_context(user_uuid: str) -> str:
    """Fetches task list, descriptions for context."""
    if not supabase or not user_uuid: return "Error: DB connection/User ID missing."

    context_items = []
    context_items.append("## Your Current Tasks:")
    try:
        # Fetch non-done tasks first, then done ones? Or just recent? Limit total.
        tasks_res = supabase.table('tasks').select('id, name, description, status, deadline, tags') \
                      .eq('user_id', user_uuid) \
                      .order('status', desc=False) \
                      .order('sort_order', nulls_first=True) \
                      .order('created_at', desc=True) \
                      .limit(30).execute()

        if tasks_res.data:
            for task in tasks_res.data:
                task_str = f"- Task ID: {task['id']}, Name: {task['name']}, Status: {task['status']}"
                if task.get('deadline'): task_str += f", Deadline: {task['deadline']}"
                if task.get('tags'): task_str += f", Tags: {', '.join(task['tags'])}"
                if task.get('description'): task_str += f"\n  Description: {task['description'][:150].strip()}..."
                context_items.append(task_str)
        else:
            context_items.append("- You have no tasks.")

        full_context = "\n".join(context_items)
        logger.info(f"Fetched context for user {user_uuid}, length {len(full_context)}")
        # Simple truncation if needed
        max_len = 3800 # Adjust based on model context window
        if len(full_context) > max_len:
            logger.warning(f"Context length ({len(full_context)}) exceeded limit {max_len}. Truncating.")
            full_context = full_context[:max_len] + "\n... (context truncated)"
        return full_context

    except Exception as e:
        logger.error(f"Error fetching task context for user {user_uuid}: {e}", exc_info=True)
        return "Error: Could not fetch task context."

async def get_ollama_response(prompt: str) -> str:
    """Gets a response from the local Ollama model."""
    logger.info(f"Sending prompt to Ollama ({OLLAMA_MODEL}). Length: {len(prompt)}")
    api_url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = { "model": OLLAMA_MODEL, "prompt": prompt, "stream": False }
    try:
        response = requests.post(api_url, json=payload, timeout=180)
        response.raise_for_status()
        data = response.json()
        response_text = data.get('response', '').strip()
        logger.info(f"Received response from Ollama. Length: {len(response_text)}")
        if not response_text:
             logger.warning("Ollama returned an empty response.")
             return "Sorry, I received an empty response from the AI model."
        return response_text
    except requests.exceptions.Timeout:
         logger.error(f"Timeout error communicating with Ollama at {api_url}")
         return "Error: The AI model took too long to respond."
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Ollama: {e}", exc_info=True)
        return f"Error: Could not connect to the Ollama AI model ({OLLAMA_BASE_URL})."
    except Exception as e:
        logger.error(f"Error processing Ollama response: {e}", exc_info=True)
        return "Error: Could not process the AI model's response."

async def determine_intent_and_params(text: str) -> dict:
    """Uses Ollama to determine intent and extract parameters."""
    # Refined prompt for clarity and robustness
    prompt = f"""[INST] Your task is to analyze the user's request below and classify it into one of the predefined intents. Extract relevant parameters for that intent. Respond ONLY with a valid JSON object containing 'intent' and 'params'.

Possible Intents:
- 'ANSWER_QUESTION': General question about tasks. Params: {{}}
- 'CREATE_TASK': Create a new task. Params: 'name' (required, string), 'description' (optional, string).
- 'ADD_CONTEXT': Add a message/note to an existing task. Params: 'task_query' (task name or keywords, required, string), 'content' (message to add, required, string).
- 'SET_DEADLINE': Set a task deadline. Params: 'task_query' (task name or keywords, required, string), 'deadline' (date string, required, YYYY-MM-DD preferred but return original string if ambiguous like 'tomorrow').
- 'UNKNOWN': Intent unclear or not task-related. Params: {{}}

User Request: "{text}"

JSON Response: [/INST]""" # Using instruction format common for some models

    response_text = await get_ollama_response(prompt)
    try:
        # Attempt to parse directly, assuming LLM follows instructions
        result = json.loads(response_text)
        if isinstance(result, dict) and 'intent' in result and 'params' in result:
             logger.info(f"Determined Intent: {result.get('intent')}, Params: {result.get('params')}")
             return result
        else:
            raise ValueError("Invalid JSON structure")
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from Ollama intent response: {response_text}")
        # Fallback: Try cleaning common LLM artifacts (like markdown) and retry
        if response_text.strip().startswith("```json"):
             cleaned_response = response_text.strip("```json \n")
        elif response_text.strip().startswith("{") and response_text.strip().endswith("}"):
             cleaned_response = response_text.strip() # Assume it's just JSON
        else:
             cleaned_response = response_text # No obvious artifact

        try:
            result = json.loads(cleaned_response)
            if isinstance(result, dict) and 'intent' in result and 'params' in result:
                logger.info(f"Determined Intent (after cleaning): {result.get('intent')}, Params: {result.get('params')}")
                return result
            else:
                 raise ValueError("Invalid JSON structure after cleaning")
        except Exception as e:
            logger.error(f"Error parsing Ollama intent JSON even after cleaning: {e}\nCleaned response: {cleaned_response}", exc_info=False)
            return {"intent": "UNKNOWN", "params": {}}
    except Exception as e: # Catch other potential errors
         logger.error(f"Unexpected error during intent parsing: {e}", exc_info=True)
         return {"intent": "UNKNOWN", "params": {}}


async def find_task_id(user_uuid: str, task_query: str) -> int | None:
    """Finds a task ID based on name query (case-insensitive)."""
    if not supabase or not user_uuid or not task_query: return None
    logger.info(f"Searching for task matching query: '{task_query}' for user {user_uuid}")
    try:
        res = supabase.table('tasks').select('id').eq('user_id', user_uuid).ilike('name', f'%{task_query}%').limit(5).execute() # Use simple LIKE match
        if len(res.data) == 1:
            task_id = res.data[0]['id']
            logger.info(f"Found unique task by name LIKE match. ID: {task_id}")
            return task_id
        elif len(res.data) > 1:
             logger.warning(f"Found multiple tasks matching query '{task_query}'. Needs clarification.")
             # TODO: Ask user to clarify which task ID or use LLM to pick best match?
             return None # Indicate ambiguity
        else:
            logger.warning(f"Could not find task matching query: '{task_query}' by name LIKE match.")
            # TODO: Optionally search description?
            return None
    except Exception as e:
        logger.error(f"Error finding task ID for query '{task_query}': {e}", exc_info=True)
        return None

# --- Telegram Command Handlers ---

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Sends explanation on /start."""
    user = update.effective_user
    if not user: return
    await update.message.reply_text(
        f"Hi {user.mention_html()}! I'm your LiquidLM Task Bot.\n"
        f"Use /link to connect your account.\n"
        f"Once linked, send me text or voice messages about your tasks.\n"
        f"Examples:\n"
        f"- 'Create task Buy Groceries desc Remember milk and eggs'\n"
        f"- 'What are my tasks?'\n"
        f"- 'Add note to Buy Groceries: Also need bread'\n"
        f"- 'Set deadline for Buy Groceries to tomorrow'\n"
        f"Commands: /link, /unlink, /cancel (during linking)"
    )

# --- Linking Conversation Handlers ---
async def link_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Starts the linking conversation, asks for email."""
    if not update.effective_user: return ConversationHandler.END
    telegram_id = update.effective_user.id
    logger.info(f"Link process started by Telegram ID: {telegram_id}")
    profile = await get_profile_by_telegram_id(telegram_id)
    if profile:
        await update.message.reply_text(f"Your account is already linked to {profile.get('email', 'an account')}.")
        return ConversationHandler.END
    await update.message.reply_text("Please enter the email address for your LiquidLM account:")
    return ASK_EMAIL

async def link_ask_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receives email, sends code, asks for code."""
    if not update.effective_user or not update.message or not update.message.text: return ConversationHandler.END
    telegram_id = update.effective_user.id
    email = update.message.text.strip().lower()
    logger.info(f"Received email '{email}' from Telegram ID: {telegram_id} for linking.")
    if not supabase:
         await update.message.reply_text("Database error. Cannot link now.")
         return ConversationHandler.END
    supabase_user_uuid = await get_user_uuid_by_email(email)
    if not supabase_user_uuid:
        await update.message.reply_text(f"Could not find a LiquidLM account for '{email}'. Check the email or sign up first.")
        return ConversationHandler.END
    code = generate_link_code()
    stored = await store_link_code(supabase_user_uuid, telegram_id, code)
    if not stored:
        await update.message.reply_text("An error occurred storing the link code. Try /link again.")
        return ConversationHandler.END
    email_sent = await send_link_code_email(email, code)
    if not email_sent:
         await update.message.reply_text("Failed to send the verification code email. Check the email address and try /link again.")
         supabase.table("profiles").update({"link_code": None, "link_code_expires_at": None}).eq("id", supabase_user_uuid).execute() # Clear failed attempt code
         return ConversationHandler.END
    await update.message.reply_text(f"A 6-digit verification code has been sent to {email}. Please enter it here (it expires in 10 minutes):")
    return ASK_CODE

async def link_verify_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Receives code, verifies it, and links account."""
    if not update.effective_user or not update.message or not update.message.text: return ConversationHandler.END
    telegram_id = update.effective_user.id
    code_attempt = update.message.text.strip()
    logger.info(f"Received code '{code_attempt}' from Telegram ID: {telegram_id} for verification.")
    if not supabase:
         await update.message.reply_text("Database error. Cannot verify code.")
         return ConversationHandler.END
    linked_info = await verify_link_code(telegram_id, code_attempt)
    if linked_info == "ALREADY_LINKED_OTHER":
         await update.message.reply_text("⚠️ This Telegram account is already linked to a different LiquidLM account. Use /unlink first if you want to change.")
    elif linked_info:
        await update.message.reply_text("✅ Success! Your Telegram account is linked.")
    else:
        await update.message.reply_text("⚠️ Invalid or expired code. Please use /link to try again.")
    return ConversationHandler.END

async def link_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancels the linking conversation."""
    if not update.effective_user: return ConversationHandler.END
    logger.info(f"Link process cancelled by user {update.effective_user.id}")
    await update.message.reply_text("Account linking cancelled.")
    return ConversationHandler.END

async def unlink(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Unlinks the user's Telegram account."""
    if not update.effective_user: return
    telegram_id = update.effective_user.id
    logger.info(f"Unlink requested by Telegram ID: {telegram_id}")
    if not supabase: await update.message.reply_text("Database error."); return
    try:
        res = supabase.table("profiles").update({"telegram_id": None}).eq("telegram_id", telegram_id).execute()
        if res.data: await update.message.reply_text("Your Telegram account has been unlinked.")
        else: await update.message.reply_text("Your account wasn't linked or an error occurred.")
    except Exception as e:
         logger.error(f"Error unlinking account for telegram_id {telegram_id}: {e}", exc_info=True)
         await update.message.reply_text("An error occurred while unlinking.")

# --- Message Handlers ---

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles regular text messages AFTER checking link."""
    supabase_user_uuid = await get_supabase_uuid(update, context)
    if not supabase_user_uuid: return # Stop if not linked
    if not supabase: await update.message.reply_text("Error: Database not connected."); return

    user_text = update.message.text
    chat_id = update.message.chat_id
    logger.info(f"Processing text from linked user {supabase_user_uuid}: {user_text[:50]}...")
    await context.bot.send_chat_action(chat_id=chat_id, action='typing')

    intent_data = await determine_intent_and_params(user_text)
    intent = intent_data.get("intent", "UNKNOWN")
    params = intent_data.get("params", {})
    reply_text = "Processing..." # Default message, should be replaced

    try:
        # --- Intent Execution Logic ---
        if intent == "CREATE_TASK":
            task_name = params.get("name")
            if task_name:
                task_desc = params.get("description")
                res = supabase.table("tasks").insert({
                    "user_id": supabase_user_uuid, "name": task_name, "description": task_desc, "status": "To do"
                }).execute()
                if res.data: reply_text = f"✅ Task created: '{task_name}'"
                else: reply_text = f"⚠️ DB Error creating task. Check logs."; logger.error(f"Task insert failed: {res}")
            else: reply_text = "⚠️ Task name missing for creation."

        elif intent == "ADD_CONTEXT":
            task_query = params.get("task_query")
            content = params.get("content")
            if task_query and content:
                task_id = await find_task_id(supabase_user_uuid, task_query)
                if task_id:
                    res = supabase.table("messages").insert({
                        "task_id": task_id, "user_id": None, "sender_email": "LiquidLM-Bot",
                        "content": content, "is_external": False # Mark as internal bot message maybe?
                    }).execute()
                    if res.data: reply_text = f"✅ Added note to task ID {task_id}."
                    else: reply_text = f"⚠️ DB Error adding note. Check logs."; logger.error(f"Msg insert failed: {res}")
                else: reply_text = f"⚠️ Task matching '{task_query}' not found to add note."
            else: reply_text = "⚠️ Missing task query or note content."

        elif intent == "SET_DEADLINE":
            task_query = params.get("task_query")
            deadline_str = params.get("deadline")
            if task_query and deadline_str:
                valid_deadline = None
                try: # Basic YYYY-MM-DD check
                    datetime.strptime(deadline_str, '%Y-%m-%d'); valid_deadline = deadline_str
                except (ValueError, TypeError):
                    logger.warning(f"Deadline '{deadline_str}' not YYYY-MM-DD. Add parsing logic if needed.")
                    # TODO: Add robust date parsing here using dateparser library or similar if required
                    # For now, only accept YYYY-MM-DD

                if not valid_deadline: reply_text = f"⚠️ Could not parse deadline '{deadline_str}'. Please use YYYY-MM-DD format."
                else:
                    task_id = await find_task_id(supabase_user_uuid, task_query)
                    if task_id:
                        res = supabase.table("tasks").update({"deadline": valid_deadline}).eq("id", task_id).eq("user_id", supabase_user_uuid).execute()
                        if res.data: reply_text = f"✅ Deadline set for task ID {task_id} to {valid_deadline}."
                        else: reply_text = f"⚠️ DB Error setting deadline (Task ID: {task_id}). Check logs."; logger.error(f"Deadline update failed: {res}")
                    else: reply_text = f"⚠️ Task matching '{task_query}' not found to set deadline."
            else: reply_text = "⚠️ Missing task query or deadline."

        elif intent == "ANSWER_QUESTION":
            task_context = await fetch_task_context(supabase_user_uuid)
            # Consider adding a system prompt for better answers
            prompt = f"System: You are a helpful assistant answering questions based ONLY on the provided task context.\nUser: {user_text}\nContext:\n---\n{task_context}\n---\nAnswer:"
            reply_text = await get_ollama_response(prompt)

        else: # UNKNOWN
            # Default fallback if intent is unclear
            task_context = await fetch_task_context(supabase_user_uuid)
            prompt = f"System: You are a helpful assistant. The user said '{user_text}', which wasn't a specific command. Respond helpfully based on their tasks if relevant, or have a brief general chat.\nContext:\n---\n{task_context}\n---\nResponse:"
            reply_text = await get_ollama_response(prompt)
            # reply_text = "Sorry, I couldn't determine a specific action. How can I help with your tasks?"


    except Exception as e:
        logger.error(f"Error processing message for user {supabase_user_uuid}: {e}", exc_info=True)
        reply_text = "❌ Sorry, an internal error occurred while processing your request."

    # Send Final Reply
    await update.message.reply_text(reply_text)


async def handle_voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handles voice messages AFTER checking link."""
    supabase_user_uuid = await get_supabase_uuid(update, context)
    if not supabase_user_uuid: return
    if not supabase: await update.message.reply_text("Error: Database not connected."); return

    chat_id = update.message.chat_id
    await context.bot.send_chat_action(chat_id=chat_id, action='record_voice')

    try:
        voice = update.message.voice
        if not voice: await update.message.reply_text("Error: No voice data."); return

        file_id = voice.file_id
        voice_file = await context.bot.get_file(file_id)
        # Ensure temp directory exists if needed, or save in current dir
        download_path = f"temp_audio_{uuid.uuid4()}.ogg"
        await voice_file.download_to_drive(download_path)
        logger.info(f"Downloaded voice file to: {download_path} for user {supabase_user_uuid}")

        # Optional mime type check
        try:
            mime = magic.from_file(download_path, mime=True)
            logger.info(f"Detected mime type: {mime}")
            if not mime.startswith('audio/'): logger.warning(f"Unexpected mime type {mime}")
        except Exception as magic_e: logger.warning(f"python-magic check failed: {magic_e}")

        await context.bot.send_chat_action(chat_id=chat_id, action='typing')
        transcribed_text = await transcribe_audio(download_path) # Cleans up file

        if transcribed_text:
            logger.info(f"Voice transcribed for user {supabase_user_uuid}. Processing as text...")
            fake_update = update # Reuse update object
            fake_update.message.text = transcribed_text # Set text content
            await handle_text_message(fake_update, context) # Process
        else:
            await update.message.reply_text("Sorry, I couldn't transcribe the audio. Please ensure it's clear or send text.")

    except Exception as e:
        logger.error(f"Error handling voice message for user {supabase_user_uuid}: {e}", exc_info=True)
        await update.message.reply_text("❌ An error occurred processing the voice message.")


# --- Main Bot Function ---
def main() -> None:
    """Configures and starts the Telegram bot."""

    # --- Essential Startup Checks ---
    if not TELEGRAM_TOKEN: logger.critical("Missing TELEGRAM_BOT_TOKEN"); return
    if not SUPABASE_URL: logger.critical("Missing SUPABASE_URL"); return
    if not SUPABASE_KEY: logger.critical("Missing SUPABASE_SERVICE_KEY"); return
    if not OLLAMA_BASE_URL: logger.critical("Missing OLLAMA_BASE_URL"); return
    if not OLLAMA_MODEL: logger.critical("Missing OLLAMA_MODEL"); return
    if not mailgun_configured: logger.warning("Mailgun is not configured. Email features disabled.")
    if not supabase: logger.critical("Supabase client failed init. Exiting."); return
    # Add check for Whisper config if needed (e.g., require OpenAI key or specific local setup)

    logger.info("LiquidLM Telegram Bot Starting...")
    application = Application.builder().token(TELEGRAM_TOKEN).build()

    # --- Add Handlers ---
    # 1. Linking Conversation (must be before generic message handlers)
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('link', link_start)],
        states={
            ASK_EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, link_ask_code)],
            ASK_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, link_verify_code)],
        },
        fallbacks=[CommandHandler('cancel', link_cancel)],
        conversation_timeout=timedelta(minutes=5).total_seconds()
    )
    application.add_handler(conv_handler, group=1) # Assign group if needed for priority

    # 2. Other Commands
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("unlink", unlink))
    # Add /help command handler if desired

    # 3. Generic Message Handlers (lower priority group or added after conversation)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))
    application.add_handler(MessageHandler(filters.VOICE, handle_voice_message))

    # --- Run Bot ---
    logger.info("Running bot polling...")
    application.run_polling(allowed_updates=Update.ALL_TYPES) # Process all update types
    logger.info("Bot polling stopped.")


# --- Run Main ---
if __name__ == '__main__':
    main()
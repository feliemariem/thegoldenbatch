/**
 * Google Apps Script - Auto-Invite on Form Submission
 *
 * This script automatically sends an invite email when someone submits
 * the Golden Batch registration interest form.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Form
 * 2. Click the three dots menu → Script editor
 * 3. Delete any existing code and paste this entire script
 * 4. Update the CONFIG values below with your actual values
 * 5. Save the script (Ctrl+S or Cmd+S)
 * 6. Click "Run" → "installTrigger" to set up the form submission trigger
 * 7. Authorize the script when prompted
 *
 * To test: Submit a test response to your form and check the execution logs
 * (View → Execution log)
 */

// ============================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================

const CONFIG = {
  // Your API key (set this in Render as GOOGLE_FORMS_API_KEY)
  // Generate one with: openssl rand -hex 32
  API_KEY: 'YOUR_API_KEY_HERE',

  // API endpoint
  API_URL: 'https://api.thegoldenbatch2003.com/api/invites/auto',

  // Form field names - update these to match your Google Form question titles
  // These are the exact titles of your form questions
  FIELD_FIRST_NAME: 'First Name',
  FIELD_LAST_NAME: 'Last Name',
  FIELD_EMAIL: 'Email Address'
};

// ============================================================
// MAIN FUNCTION - Triggered on form submission
// ============================================================

function onFormSubmit(e) {
  try {
    // Get form response
    const response = e.response;
    const itemResponses = response.getItemResponses();

    // Extract values from form fields
    let firstName = '';
    let lastName = '';
    let email = '';

    for (const itemResponse of itemResponses) {
      const title = itemResponse.getItem().getTitle();
      const value = itemResponse.getResponse();

      if (title === CONFIG.FIELD_FIRST_NAME) {
        firstName = value;
      } else if (title === CONFIG.FIELD_LAST_NAME) {
        lastName = value;
      } else if (title === CONFIG.FIELD_EMAIL) {
        email = value;
      }
    }

    // Validate we have all required fields
    if (!firstName || !lastName || !email) {
      console.error('Missing required fields:', { firstName, lastName, email });
      return;
    }

    // Call the API
    const result = callAutoInviteAPI(firstName, lastName, email);

    // Log the result
    console.log('Auto-invite result:', JSON.stringify(result));

  } catch (error) {
    console.error('Error processing form submission:', error.toString());
  }
}

// ============================================================
// API CALL FUNCTION
// ============================================================

function callAutoInviteAPI(firstName, lastName, email) {
  const payload = {
    first_name: firstName,
    last_name: lastName,
    email: email
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-api-key': CONFIG.API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Don't throw on non-2xx responses
  };

  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`API Response [${responseCode}]: ${responseBody}`);

    return {
      success: responseCode >= 200 && responseCode < 300,
      statusCode: responseCode,
      body: JSON.parse(responseBody)
    };

  } catch (error) {
    console.error('API call failed:', error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ============================================================
// TRIGGER INSTALLATION - Run this once to set up the trigger
// ============================================================

function installTrigger() {
  // Remove any existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Get the form this script is attached to
  const form = FormApp.getActiveForm();

  if (!form) {
    console.error('This script must be attached to a Google Form. Open the form and go to Script editor.');
    return;
  }

  // Create new trigger
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  console.log('Trigger installed successfully! Form submissions will now auto-create invites.');
}

// ============================================================
// TEST FUNCTION - Use this to test the API connection
// ============================================================

function testAPIConnection() {
  // Test with dummy data - this will either create an invite or say "already exists"
  const result = callAutoInviteAPI('Test', 'User', 'test@example.com');

  console.log('Test result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('API connection successful!');
  } else {
    console.error('API connection failed. Check your API_KEY and API_URL.');
  }
}

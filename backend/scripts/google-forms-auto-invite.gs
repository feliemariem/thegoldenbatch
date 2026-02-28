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
  FIELD_EMAIL: 'Email'
};

// ============================================================
// MAIN FUNCTION - Triggered on form submission
// ============================================================

function onFormSubmit(e) {
  console.log('onFormSubmit triggered');

  try {
    // Debug: Log the event object structure
    console.log('Event object type:', typeof e);
    console.log('Event object:', JSON.stringify(e));

    // Check if event object exists
    if (!e) {
      console.error('Event object is undefined. Make sure to run installTrigger() first.');
      return;
    }

    // Get form response - handle different event structures
    let formResponse;

    if (e.response) {
      // Standard form trigger (script attached to form)
      formResponse = e.response;
    } else if (e.values) {
      // Spreadsheet trigger (script attached to response spreadsheet)
      // e.values is an array of the submitted values
      console.log('Detected spreadsheet trigger. Values:', e.values);
      handleSpreadsheetSubmission(e);
      return;
    } else {
      console.error('Unexpected event structure. Keys:', Object.keys(e));
      return;
    }

    if (!formResponse) {
      console.error('No form response found in event object');
      return;
    }

    const itemResponses = formResponse.getItemResponses();
    console.log('Number of responses:', itemResponses.length);

    // Extract values from form fields
    let firstName = '';
    let lastName = '';
    let email = '';

    for (let i = 0; i < itemResponses.length; i++) {
      const itemResponse = itemResponses[i];
      const title = itemResponse.getItem().getTitle();
      const value = itemResponse.getResponse();

      console.log('Field "' + title + '":', value);

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
      console.error('Missing required fields. firstName:', firstName, 'lastName:', lastName, 'email:', email);
      console.error('Check that CONFIG.FIELD_* values match your form question titles exactly.');
      return;
    }

    console.log('Calling API for:', firstName, lastName, email);

    // Call the API
    const result = callAutoInviteAPI(firstName, lastName, email);

    // Log the result
    console.log('Auto-invite result:', JSON.stringify(result));

  } catch (error) {
    console.error('Error processing form submission:', error.toString());
    console.error('Error stack:', error.stack);
  }
}

// ============================================================
// HANDLE SPREADSHEET TRIGGER (if script is attached to sheet)
// ============================================================

function handleSpreadsheetSubmission(e) {
  // When triggered from a spreadsheet, e.values contains the row data
  // Column order depends on your form structure
  // Typically: [Timestamp, Question1, Question2, Question3, ...]

  console.log('Processing spreadsheet submission');
  console.log('Values array:', JSON.stringify(e.values));
  console.log('Range:', e.range ? e.range.getA1Notation() : 'N/A');

  // You'll need to adjust these indices based on your form's column order
  // Check your spreadsheet to see which column contains which field
  // Column A (index 0) is usually Timestamp
  const values = e.values;

  if (!values || values.length < 4) {
    console.error('Not enough values in submission. Expected at least 4 columns.');
    return;
  }

  // ADJUST THESE INDICES based on your spreadsheet columns:
  // Index 0 = Timestamp (usually)
  // Index 1, 2, 3 = Your form fields (check your sheet)
  const firstName = values[1]; // Adjust index as needed
  const lastName = values[2];  // Adjust index as needed
  const email = values[3];     // Adjust index as needed

  console.log('Extracted - firstName:', firstName, 'lastName:', lastName, 'email:', email);

  if (!firstName || !lastName || !email) {
    console.error('Missing required fields. Check column indices in handleSpreadsheetSubmission()');
    return;
  }

  const result = callAutoInviteAPI(firstName, lastName, email);
  console.log('Auto-invite result:', JSON.stringify(result));
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

  console.log('Calling API:', CONFIG.API_URL);
  console.log('Payload:', JSON.stringify(payload));

  let response;
  try {
    response = UrlFetchApp.fetch(CONFIG.API_URL, options);
  } catch (fetchError) {
    console.error('UrlFetchApp.fetch() threw an error:', fetchError.toString());
    return {
      success: false,
      error: fetchError.toString()
    };
  }

  // Response is defined, now safely access its methods
  let responseCode;
  let responseBody;

  try {
    responseCode = response.getResponseCode();
    responseBody = response.getContentText();
  } catch (readError) {
    console.error('Error reading response:', readError.toString());
    return {
      success: false,
      error: 'Failed to read response: ' + readError.toString()
    };
  }

  console.log('API Response [' + responseCode + ']: ' + responseBody);

  let parsedBody;
  try {
    parsedBody = JSON.parse(responseBody);
  } catch (parseError) {
    console.error('Failed to parse response JSON:', parseError.toString());
    parsedBody = { raw: responseBody };
  }

  return {
    success: responseCode >= 200 && responseCode < 300,
    statusCode: responseCode,
    body: parsedBody
  };
}

// ============================================================
// TRIGGER INSTALLATION - Run this once to set up the trigger
// ============================================================

function installTrigger() {
  // Remove any existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  }

  if (removed > 0) {
    console.log('Removed ' + removed + ' existing trigger(s)');
  }

  // Try to get the form this script is attached to
  let form;
  try {
    form = FormApp.getActiveForm();
  } catch (formError) {
    console.log('Not attached to a form directly. Trying spreadsheet trigger...');
  }

  if (form) {
    // Create form-based trigger
    ScriptApp.newTrigger('onFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();
    console.log('Form trigger installed successfully!');
    console.log('Form title: ' + form.getTitle());
  } else {
    // Try spreadsheet-based trigger
    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    } catch (ssError) {
      console.error('Not attached to a form or spreadsheet.');
      console.error('Please open this script from: Form → Three dots → Script editor');
      return;
    }

    if (spreadsheet) {
      ScriptApp.newTrigger('onFormSubmit')
        .forSpreadsheet(spreadsheet)
        .onFormSubmit()
        .create();
      console.log('Spreadsheet trigger installed successfully!');
      console.log('Spreadsheet name: ' + spreadsheet.getName());
      console.log('NOTE: You may need to adjust column indices in handleSpreadsheetSubmission()');
    }
  }

  console.log('Done! Form submissions will now auto-create invites.');
}

// ============================================================
// DEBUG: List all triggers
// ============================================================

function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  console.log('Found ' + triggers.length + ' trigger(s):');

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    console.log('  ' + (i + 1) + '. ' + trigger.getHandlerFunction() + ' - ' + trigger.getEventType());
  }
}

// ============================================================
// TEST FUNCTION - Use this to test the API connection
// ============================================================

function testAPIConnection() {
  console.log('Testing API connection...');
  console.log('API URL:', CONFIG.API_URL);
  console.log('API Key:', CONFIG.API_KEY.substring(0, 8) + '...');

  // Test with dummy data - this will either create an invite or say "already exists"
  const result = callAutoInviteAPI('Test', 'User', 'test-' + Date.now() + '@example.com');

  console.log('Test result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('SUCCESS! API connection is working.');
  } else {
    console.error('FAILED. Check your API_KEY and API_URL.');
    if (result.statusCode === 401) {
      console.error('401 Unauthorized - Your API key is incorrect.');
    } else if (result.statusCode === 500) {
      console.error('500 Server Error - Check the server logs.');
    }
  }
}

// ============================================================
// DEBUG: Manually test with hardcoded values
// ============================================================

function testManualSubmit() {
  console.log('Testing with manual values...');

  const firstName = 'John';
  const lastName = 'Doe';
  const email = 'john.doe.' + Date.now() + '@example.com';

  console.log('Testing:', firstName, lastName, email);

  const result = callAutoInviteAPI(firstName, lastName, email);
  console.log('Result:', JSON.stringify(result, null, 2));
}

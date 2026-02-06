/**
 * FormSubmission - Form submission orchestration module for Moorent Pm onboarding questionnaire.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.FormSubmission.
 *
 * CRITICAL: All fetch calls to Apps Script use Content-Type: 'text/plain;charset=utf-8'
 * to avoid CORS preflight (application/json triggers preflight that Apps Script cannot handle).
 *
 * Email sending is handled server-side by Apps Script MailApp (no client-side email service).
 */
(function () {
  'use strict';

  // Italian professional error messages (per locked decision: tono professionale e conciso)
  var ERROR_MESSAGES = {
    invioFallito: 'Si \u00e8 verificato un errore durante l\'invio. Riprovare.',
    serverErrore: 'Il server non ha risposto correttamente. Riprovare tra qualche istante.',
    retryEsaurito: 'Impossibile completare l\'invio dopo pi\u00f9 tentativi. Verificare la connessione.'
  };

  /**
   * Encode files as base64 for transmission.
   * @param {Array<File>} files - Array of File objects (or empty array/null)
   * @returns {Promise<Array<object>>} Promise resolving to array of encoded file objects
   */
  function encodeFiles(files) {
    if (!files || files.length === 0) {
      return Promise.resolve([]);
    }

    var encodingPromises = [];
    for (var i = 0; i < files.length; i++) {
      encodingPromises.push(encodeFile(files[i]));
    }

    return Promise.all(encodingPromises);
  }

  /**
   * Encode a single file as base64.
   * @param {File} file - File object to encode
   * @returns {Promise<object>} Promise resolving to encoded file object
   */
  function encodeFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        // result is data:mime;base64,base64string - strip the prefix
        var dataUrl = reader.result;
        var base64Index = dataUrl.indexOf(',');
        var base64Data = dataUrl.substring(base64Index + 1);
        resolve({
          data: base64Data,
          mimeType: file.type,
          fileName: file.name
        });
      };
      reader.onerror = function () {
        reject(new Error('Errore durante la lettura del file: ' + file.name));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Submit payload to Apps Script with retry logic and exponential backoff.
   * @param {object} payload - Payload to send
   * @param {number} maxAttempts - Maximum number of retry attempts (default: 3)
   * @returns {Promise<object>} Promise resolving to server response
   */
  function submitWithRetry(payload, maxAttempts) {
    var attempt = 0;
    maxAttempts = maxAttempts || 3;

    function attemptSubmit() {
      attempt = attempt + 1;

      return fetch(window.CONFIG.appsScriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error(ERROR_MESSAGES.serverErrore);
          }
          return response.json();
        })
        .then(function (result) {
          if (result.success === false) {
            throw new Error(result.error || ERROR_MESSAGES.serverErrore);
          }
          return result;
        })
        .catch(function (error) {
          // If we have retries left, wait and retry with exponential backoff
          if (attempt < maxAttempts) {
            var delayMs = Math.pow(2, attempt - 1) * 1000;
            return new Promise(function (resolve) {
              setTimeout(resolve, delayMs);
            }).then(function () {
              return attemptSubmit();
            });
          }
          // No retries left - throw final error
          throw new Error(ERROR_MESSAGES.retryEsaurito);
        });
    }

    return attemptSubmit();
  }

  /**
   * Main form submission function.
   * Encodes files, sends to Apps Script with retry, returns result.
   * Email sending is handled server-side by Apps Script MailApp.
   * @param {object} formData - Form data object (flat fields)
   * @param {Array<File>} files - Array of File objects (optional)
   * @returns {Promise<object>} Promise resolving to { success: true } or rejecting with error
   */
  function submitForm(formData, files) {
    console.log('[FormSubmission] Starting form submission...');

    // Step 1: Encode files as base64
    return encodeFiles(files || [])
      .then(function (encodedFiles) {
        console.log('[FormSubmission] Files encoded:', encodedFiles.length);

        // Step 2: Build payload
        var payload = {
          action: 'submit',
          data: formData,
          files: encodedFiles
        };

        // Step 3: Submit to Apps Script with retry logic
        return submitWithRetry(payload, 3);
      })
      .then(function (result) {
        console.log('[FormSubmission] Submission successful:', result);
        return { success: true };
      })
      .catch(function (error) {
        console.error('[FormSubmission] Submission failed:', error);
        throw new Error(ERROR_MESSAGES.retryEsaurito);
      });
  }

  /**
   * Submit form with pre-encoded files (from FormState).
   * Files are already base64 data URLs stored in FormState.
   * @param {object} formData - Form data object (flat fields)
   * @param {Array<object>} encodedFiles - Array of { data, fileName, mimeType }
   * @returns {Promise<object>} Promise resolving to { success: true } or rejecting with error
   */
  function submitPreEncoded(formData, encodedFiles) {
    console.log('[FormSubmission] Starting submission with pre-encoded files...');

    // Process encoded files: extract base64 from data URLs if needed
    var processedFiles = [];
    var i;
    for (i = 0; i < encodedFiles.length; i++) {
      var file = encodedFiles[i];
      var base64Data = file.data;

      // If data is a full data URL, extract base64 portion
      var dataUrlMatch = base64Data.match(/^data:[^;]+;base64,(.+)$/);
      if (dataUrlMatch) {
        base64Data = dataUrlMatch[1];
      }

      processedFiles.push({
        data: base64Data,
        fileName: file.fileName,
        mimeType: file.mimeType
      });
    }

    // Build payload
    var payload = {
      action: 'submit',
      data: formData,
      files: processedFiles
    };

    // Submit to Apps Script with retry logic
    return submitWithRetry(payload, 3)
      .then(function (result) {
        console.log('[FormSubmission] Submission successful:', result);
        return { success: true };
      })
      .catch(function (error) {
        console.error('[FormSubmission] Submission failed:', error);
        throw new Error(ERROR_MESSAGES.retryEsaurito);
      });
  }

  // Expose public API
  window.FormSubmission = {
    submitForm: submitForm,
    submitPreEncoded: submitPreEncoded
  };

}());

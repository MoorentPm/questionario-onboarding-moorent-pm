/**
 * StepPrivacy - Privacy consent and submission orchestration for Moorent Pm onboarding.
 * Handles checkbox gating, duplicate prevention, form submission, and success state.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.StepPrivacy.
 */
(function () {
  'use strict';

  var SUBMISSION_KEY = 'moorent-onboarding-submitted';
  var SUBMISSION_LOCKOUT_HOURS = 24;

  var hasSubmitted = false;
  var checkbox = null;
  var submitButton = null;
  var loadingInterval = null;

  var LOADING_MESSAGES = [
    'Invio in corso...',
    'Stiamo preparando i tuoi dati...',
    'Quasi ci siamo...',
    'Un attimo, stiamo organizzando tutto...',
    'I documenti stanno volando verso di noi...',
    'Ci siamo quasi, ancora un secondo...',
    'Stiamo facendo il check finale...',
    'Fatto! Ultimi ritocchi...'
  ];

  /**
   * Check if form was recently submitted (within SUBMISSION_LOCKOUT_HOURS).
   * @returns {boolean}
   */
  function checkDuplicatePrevention() {
    try {
      var submittedTimestamp = localStorage.getItem(SUBMISSION_KEY);
      if (!submittedTimestamp) {
        return false;
      }

      var submittedDate = new Date(submittedTimestamp);
      var now = new Date();
      var hoursDiff = (now - submittedDate) / (1000 * 60 * 60);

      if (hoursDiff < SUBMISSION_LOCKOUT_HOURS) {
        // Recently submitted - show success state
        return true;
      } else {
        // Lockout expired - allow new submission
        return false;
      }
    } catch (e) {
      // Fail open - allow submission if localStorage check fails
      return false;
    }
  }

  /**
   * Mark submission timestamp in localStorage.
   */
  function markSubmitted() {
    try {
      var now = new Date().toISOString();
      localStorage.setItem(SUBMISSION_KEY, now);
    } catch (e) {
      console.warn('[StepPrivacy] Failed to mark submission in localStorage:', e.message);
    }
  }

  /**
   * Show success state - replace form with thank-you message.
   */
  function showSuccessState() {
    var formContainer = document.querySelector('main.form-container');
    var formNav = document.getElementById('form-nav');
    var progressText = document.getElementById('progress-text');
    var progressBar = document.getElementById('form-progress');

    if (!formContainer) {
      return;
    }

    // Hide navigation
    if (formNav) {
      formNav.style.display = 'none';
    }

    // Set progress to complete
    if (progressText) {
      progressText.textContent = 'Completato';
    }
    if (progressBar) {
      progressBar.value = 100;
    }

    // Replace form content with success message
    formContainer.innerHTML = '<div class="success-container">' +
      '<div class="success-icon">' +
      '<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="40" cy="40" r="38" fill="#f3dfd9" stroke="#232323" stroke-width="2"/>' +
      '<path d="M25 40 L35 50 L55 30" stroke="#232323" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '</div>' +
      '<h2>Grazie!</h2>' +
      '<p class="success-message">Abbiamo ricevuto il tuo questionario.</p>' +
      '<p class="success-hint">Riceverai una email di conferma a breve.</p>' +
      '</div>';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /**
   * Flatten FormState data into flat object for submission.
   * Maps form field names to Code.gs expected keys.
   * @param {object} formData - FormState.formData object (step0-step6)
   * @returns {object} Flat data object
   */
  function flattenFormData(formData) {
    var flat = {};
    var stepKey;
    var fieldName;
    var value;

    // Iterate all step keys
    for (stepKey in formData) {
      if (!formData.hasOwnProperty(stepKey)) {
        continue;
      }
      var stepData = formData[stepKey];
      for (fieldName in stepData) {
        if (!stepData.hasOwnProperty(fieldName)) {
          continue;
        }
        value = stepData[fieldName];

        // Map form field names to Code.gs keys
        switch (fieldName) {
          case 'nome':
            flat.nome = value;
            break;
          case 'cognome':
            flat.cognome = value;
            break;
          case 'data-nascita':
            flat.dataNascita = value;
            break;
          case 'codice-fiscale':
            flat.codiceFiscale = value;
            break;
          case 'email':
            flat.email = value;
            break;
          case 'telefono':
            flat.telefono = value;
            break;
          case 'tracking-source':
            flat.comeConosciuto = value;
            break;
          case 'referral-name':
            flat.chiPresentato = value;
            break;
          case 'altre-spese':
            flat.note = value;
            break;
          case 'spese-condominio':
            flat.speseCondominio = value;
            break;
          case 'imu':
            flat.imu = value;
            break;
          case 'tari':
            flat.tari = value;
            break;
          case 'utenze':
            flat.utenzeMedie = value;
            break;
          default:
            // Keep other fields as-is
            break;
        }
      }
    }

    // Build address strings from components
    var step1 = formData.step1 || {};
    var step2 = formData.step2 || {};

    // Indirizzo personale
    if (step1['via-residenza']) {
      var parts = [
        step1['via-residenza'],
        step1['civico-residenza'],
        step1['cap-residenza'] + ' ' + step1['citta-residenza'],
        '(' + step1['provincia-residenza'] + ')'
      ];
      flat.indirizzoPersonale = parts.filter(function (p) { return p && p !== '()'; }).join(', ');
    }

    // Indirizzo immobile
    if (step2['via-immobile']) {
      var partsImm = [
        step2['via-immobile'],
        step2['civico-immobile'],
        step2['cap-immobile'] + ' ' + step2['citta-immobile'],
        '(' + step2['provincia-immobile'] + ')'
      ];
      flat.indirizzoImmobile = partsImm.filter(function (p) { return p && p !== '()'; }).join(', ');
    }

    // Privacy consent
    flat.privacyAccettata = true;

    return flat;
  }

  /**
   * Extract files from FormState step 3 (Documenti).
   * @returns {Array<object>} Array of file objects { data, fileName, mimeType }
   */
  function getFilesFromState() {
    if (typeof FormState === 'undefined' || !FormState.getStepData) {
      return [];
    }

    var step3 = FormState.getStepData(3);
    var files = [];
    var targets = ['fronte', 'retro'];
    var i;

    for (i = 0; i < targets.length; i++) {
      var target = targets[i];
      var dataUrl = step3['documento-' + target];
      var filename = step3['documento-' + target + '-filename'];
      var mimeType = step3['documento-' + target + '-type'];

      if (dataUrl && filename && mimeType) {
        files.push({
          data: dataUrl,
          fileName: filename,
          mimeType: mimeType
        });
      }
    }

    return files;
  }

  /**
   * Handle successful submission.
   */
  function handleSubmitSuccess() {
    // Mark submission timestamp
    markSubmitted();

    // Show success state
    showSuccessState();

    // Clear FormState (after showing success)
    if (typeof FormState !== 'undefined' && FormState.clearState) {
      FormState.clearState();
    }
  }

  /**
   * Handle submission error.
   */
  function handleSubmitError() {
    // Stop loading messages
    stopLoadingMessages();

    // Reset hasSubmitted flag
    hasSubmitted = false;

    // Re-enable submit button if checkbox still checked
    if (submitButton && checkbox && checkbox.checked) {
      submitButton.disabled = false;
      submitButton.textContent = 'Invia questionario';
      submitButton.classList.remove('loading');
    }

    // Show error alert
    alert('Si è verificato un errore durante l\'invio. Riprova tra qualche istante.');
  }

  /**
   * Start rotating loading messages below the submit button.
   */
  function startLoadingMessages() {
    var submitContainer = submitButton.closest('.submit-container');
    if (!submitContainer) {
      return;
    }

    // Replace submit-hint with loading message element
    var hint = submitContainer.querySelector('.submit-hint');
    if (hint) {
      hint.style.display = 'none';
    }

    var msgEl = document.createElement('p');
    msgEl.id = 'loading-message';
    msgEl.className = 'loading-message';
    msgEl.textContent = LOADING_MESSAGES[0];
    submitContainer.appendChild(msgEl);

    var index = 1;
    loadingInterval = setInterval(function () {
      if (index < LOADING_MESSAGES.length) {
        msgEl.textContent = LOADING_MESSAGES[index];
        index++;
      } else {
        // Stay on last message
        clearInterval(loadingInterval);
        loadingInterval = null;
      }
    }, 3000);
  }

  /**
   * Stop loading messages and clean up.
   */
  function stopLoadingMessages() {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }
    var msgEl = document.getElementById('loading-message');
    if (msgEl) {
      msgEl.remove();
    }
    var submitContainer = submitButton ? submitButton.closest('.submit-container') : null;
    if (submitContainer) {
      var hint = submitContainer.querySelector('.submit-hint');
      if (hint) {
        hint.style.display = '';
      }
    }
  }

  /**
   * Handle submit button click.
   */
  function handleSubmit() {
    // Guard: already submitted
    if (hasSubmitted) {
      return;
    }

    // Guard: checkbox not checked
    if (!checkbox || !checkbox.checked) {
      return;
    }

    // Set hasSubmitted flag
    hasSubmitted = true;

    // Disable button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Invio in corso...';
    submitButton.classList.add('loading');

    // Start rotating fun messages
    startLoadingMessages();

    // Get state
    if (typeof FormState === 'undefined' || !FormState.getState) {
      handleSubmitError();
      return;
    }

    var state = FormState.getState();

    // Build flat form data
    var formData = flattenFormData(state.formData);

    // Get files from state
    var files = getFilesFromState();

    // Submit via FormSubmission module
    if (typeof FormSubmission === 'undefined' || !FormSubmission.submitPreEncoded) {
      handleSubmitError();
      return;
    }

    FormSubmission.submitPreEncoded(formData, files)
      .then(function () {
        handleSubmitSuccess();
      })
      .catch(function (error) {
        console.error('[StepPrivacy] Submission failed:', error);
        handleSubmitError();
      });
  }

  /**
   * Initialize StepPrivacy module.
   * Called from app.js on DOMContentLoaded.
   */
  function init() {
    // Get DOM elements
    checkbox = document.getElementById('privacy-checkbox');
    submitButton = document.getElementById('submit-btn');

    if (!checkbox || !submitButton) {
      return;
    }

    // Check for duplicate submission
    if (checkDuplicatePrevention()) {
      showSuccessState();
      return;
    }

    // Initialize: submit button disabled
    submitButton.disabled = true;

    // Checkbox change listener
    checkbox.addEventListener('change', function () {
      submitButton.disabled = !checkbox.checked;
    });

    // Submit button click listener
    submitButton.addEventListener('click', handleSubmit);
  }

  // Expose public API
  window.StepPrivacy = {
    init: init
  };

}());

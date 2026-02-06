/**
 * app.js - Application entry point for Moorent Pm onboarding questionnaire.
 * Handles initialization, session resumption, field sync, and navigation wiring.
 * Uses IIFE to avoid polluting global scope.
 */
(function () {
  'use strict';

  /**
   * Restore all form field values from saved state.
   */
  function restoreFieldValues() {
    var fields = document.querySelectorAll('input[name], select[name], textarea[name]');
    var i;
    for (i = 0; i < fields.length; i++) {
      var field = fields[i];
      var formStep = field.closest('.form-step');
      if (!formStep) {
        continue;
      }
      var stepAttr = formStep.getAttribute('data-step');
      if (stepAttr === null) {
        continue;
      }
      var stepIndex = parseInt(stepAttr, 10);
      var stepData = FormState.getStepData(stepIndex);
      var fieldName = field.name;
      if (!fieldName || !(fieldName in stepData)) {
        continue;
      }
      var savedValue = stepData[fieldName];
      if (field.type === 'file') {
        continue;
      } else if (field.type === 'checkbox') {
        field.checked = !!savedValue;
      } else if (field.type === 'radio') {
        field.checked = (field.value === savedValue);
      } else {
        field.value = savedValue !== null && savedValue !== undefined ? savedValue : '';
      }
    }
  }

  /**
   * Handle input/change events via delegation for auto-save.
   * @param {Event} event
   */
  function onFieldChange(event) {
    var target = event.target;
    if (!target.name) {
      return;
    }
    var formStep = target.closest('.form-step');
    if (!formStep) {
      return;
    }
    var stepAttr = formStep.getAttribute('data-step');
    if (stepAttr === null) {
      return;
    }
    var stepIndex = parseInt(stepAttr, 10);
    var value;
    if (target.type === 'checkbox') {
      value = target.checked;
    } else {
      value = target.value;
    }
    FormState.setFieldValue(stepIndex, target.name, value);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Guard: ensure dependencies are available
    if (typeof FormState === 'undefined' || typeof FormNav === 'undefined' || typeof FormValidation === 'undefined') {
      console.error('[App] FormState, FormNav, or FormValidation not available. Check script load order.');
      // Attempt to show step 0 as fallback using DOM directly
      var steps = document.querySelectorAll('.form-step');
      var j;
      for (j = 0; j < steps.length; j++) {
        steps[j].classList.remove('active');
      }
      var firstStep = document.querySelector('.form-step[data-step="0"]');
      if (firstStep) {
        firstStep.classList.add('active');
      }
      return;
    }

    // 1. Check for existing session
    var sessionExists = FormState.loadState();
    var startStep = 0;
    if (sessionExists) {
      var savedStep = FormState.getCurrentStep();
      // Validate saved step is in range
      if (savedStep >= 0 && savedStep < 7) {
        startStep = savedStep;
      } else {
        startStep = 0;
      }
    }

    // 2. Show the appropriate step
    FormNav.showStep(startStep);

    // 3. Restore form field values from saved state
    restoreFieldValues();

    // 4. Initialize validation engine
    FormValidation.init();

    // 5. Register address fields and load Google Maps API for autocomplete
    if (typeof AddressAutocomplete !== 'undefined') {
      // Indirizzo di residenza (Step 1)
      AddressAutocomplete.init('via-residenza', {
        via: 'via-residenza',
        civico: 'civico-residenza',
        cap: 'cap-residenza',
        citta: 'citta-residenza',
        provincia: 'provincia-residenza'
      }, 1);

      // Indirizzo immobile (Step 2)
      AddressAutocomplete.init('via-immobile', {
        via: 'via-immobile',
        civico: 'civico-immobile',
        cap: 'cap-immobile',
        citta: 'citta-immobile',
        provincia: 'provincia-immobile'
      }, 2);

      if (AddressAutocomplete.loadApi) {
        AddressAutocomplete.loadApi();
      }
    }

    // Codice Fiscale validation
    if (typeof CodiceFiscale !== 'undefined' && CodiceFiscale.init) {
      CodiceFiscale.init('codice-fiscale', {
        nome: 'nome',
        cognome: 'cognome',
        dataNascita: 'data-nascita'
      });
    }

    // Phase 4: Step-specific logic initialization
    if (typeof StepFields !== 'undefined' && StepFields.init) {
      StepFields.init();
    }

    if (typeof StepDocumenti !== 'undefined' && StepDocumenti.init) {
      StepDocumenti.init();
    }

    if (typeof StepReview !== 'undefined' && StepReview.init) {
      StepReview.init();
    }

    if (typeof StepPrivacy !== 'undefined' && StepPrivacy.init) {
      StepPrivacy.init();
    }

    // 6. Attach input change listeners via event delegation on form container
    var formContainer = document.querySelector('main.form-container');
    if (formContainer) {
      formContainer.addEventListener('input', onFieldChange);
      formContainer.addEventListener('change', onFieldChange);
    }

    // 7. Wire navigation buttons
    var nextBtn = document.getElementById('nextBtn');
    var prevBtn = document.getElementById('prevBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        FormNav.navigateForward();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        FormNav.navigateBackward();
      });
    }

    console.log('Moorent Pm Onboarding initialized', FormState.hasExistingSession() ? '(session resumed)' : '(new session)');
  });

}());

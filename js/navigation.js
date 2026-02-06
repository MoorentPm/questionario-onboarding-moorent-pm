/**
 * FormNav - Navigation module for the Moorent Pm multi-step onboarding form.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.FormNav.
 */
(function () {
  'use strict';

  var TOTAL_STEPS = 7;

  var STEP_NAMES = [
    'Benvenuto',
    'Dati Personali',
    'Dati Immobile',
    'Documenti',
    'Tracking & Note',
    'Riepilogo',
    'Privacy & Invio'
  ];

  /**
   * Show the step at the given index, hide all others.
   * Updates progress bar, button states, and persists step.
   * @param {number} stepIndex
   */
  function showStep(stepIndex) {
    var steps = document.querySelectorAll('.form-step');
    var i;
    for (i = 0; i < steps.length; i++) {
      steps[i].classList.remove('active');
    }
    var targetStep = document.querySelector('.form-step[data-step="' + stepIndex + '"]');
    if (targetStep) {
      targetStep.classList.add('active');
    }

    // Refresh review data every time Riepilogo (step 5) is shown
    if (stepIndex === 5 && typeof StepReview !== 'undefined' && StepReview.populate) {
      StepReview.populate();
    }

    // Restore document uploads when returning to Step 4 (data-step 3)
    if (stepIndex === 3 && typeof StepDocumenti !== 'undefined' && StepDocumenti.restoreUploads) {
      StepDocumenti.restoreUploads();
    }

    updateProgress(stepIndex);
    updateButtons(stepIndex);
    window.scrollTo({ top: 0, behavior: 'instant' });
    FormState.setCurrentStep(stepIndex);
  }

  /**
   * Update the progress bar value and progress text.
   * @param {number} stepIndex
   */
  function updateProgress(stepIndex) {
    var percentage = ((stepIndex + 1) / TOTAL_STEPS) * 100;
    var progressEl = document.getElementById('form-progress');
    var progressText = document.getElementById('progress-text');
    if (progressEl) {
      progressEl.value = percentage;
    }
    if (progressText) {
      progressText.textContent = 'Step ' + (stepIndex + 1) + ' di 7 — ' + STEP_NAMES[stepIndex];
    }
  }

  /**
   * Control button visibility and text based on current step.
   * @param {number} stepIndex
   */
  function updateButtons(stepIndex) {
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
      if (stepIndex === 0) {
        prevBtn.style.display = 'none';
      } else {
        prevBtn.style.display = '';
      }
    }

    if (nextBtn) {
      // Remove btn-submit class before conditionally re-adding
      nextBtn.classList.remove('btn-submit');

      if (stepIndex === 6) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.textContent = stepIndex === 0 ? 'Inizia' : 'Avanti';
      }
    }
  }

  /**
   * Move to the next step.
   * Validates current step before advancing (steps 1-5 only).
   */
  function navigateForward() {
    var currentStep = FormState.getCurrentStep();

    // Step 0 (welcome) and Step 5 (riepilogo) have no validation
    // Step 6 is submission -- handled in Phase 6
    if (currentStep >= 6) {
      return;
    }

    // Validate current step before advancing (skip step 0 -- welcome page)
    if (currentStep > 0 && currentStep < 6) {
      // Check if FormValidation is available (Phase 3 module)
      if (typeof FormValidation !== 'undefined' && FormValidation.showStepErrors) {
        var isValid = FormValidation.showStepErrors(currentStep);
        if (!isValid) {
          // Errors shown and scrolled to first error by showStepErrors
          return; // Block navigation
        }
      }
    }

    showStep(currentStep + 1);
  }

  /**
   * Move to the previous step.
   */
  function navigateBackward() {
    var currentStep = FormState.getCurrentStep();
    if (currentStep <= 0) {
      return;
    }
    showStep(currentStep - 1);
  }

  /**
   * Get the current step index from FormState.
   * @returns {number}
   */
  function getCurrentStepIndex() {
    return FormState.getCurrentStep();
  }

  // Expose public API
  window.FormNav = {
    showStep: showStep,
    updateProgress: updateProgress,
    updateButtons: updateButtons,
    navigateForward: navigateForward,
    navigateBackward: navigateBackward,
    getCurrentStepIndex: getCurrentStepIndex
  };

}());

/**
 * StepFields - Step-specific interactive logic for Moorent Pm onboarding.
 * Handles expense calculations and conditional field visibility.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.StepFields.
 */
(function () {
  'use strict';

  /**
   * Calculate annual total from expense fields and update display.
   * Formula: (spese-condominio * 12) + imu + tari + (utenze * 12)
   */
  function calculateAnnualTotal() {
    var speseCondominio = parseFloat(document.getElementById('spese-condominio').value) || 0;
    var imu = parseFloat(document.getElementById('imu').value) || 0;
    var tari = parseFloat(document.getElementById('tari').value) || 0;
    var utenze = parseFloat(document.getElementById('utenze').value) || 0;

    var total = (speseCondominio * 12) + imu + tari + (utenze * 12);

    var formatter = new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    });
    var formattedTotal = formatter.format(total);

    var totalElement = document.getElementById('totale-spese');
    if (totalElement) {
      totalElement.textContent = formattedTotal;
    }

    // Save to FormState for review page
    if (typeof FormState !== 'undefined' && FormState.setFieldValue) {
      FormState.setFieldValue(2, 'totale-spese-annuali', total);
    }
  }

  /**
   * Handle tracking source selection and conditional referral field visibility.
   */
  function handleTrackingSelection() {
    var trackingRadios = document.querySelectorAll('input[name="tracking-source"]');
    var referralField = document.getElementById('referral-field');
    var referralInput = document.getElementById('referral-name');

    if (!referralField || !referralInput) {
      return;
    }

    var i;
    for (i = 0; i < trackingRadios.length; i++) {
      trackingRadios[i].addEventListener('change', function () {
        var passaparolaRadio = document.getElementById('tracking-passaparola');

        if (passaparolaRadio && passaparolaRadio.checked) {
          // Show referral field
          referralField.style.display = 'block';
          referralField.setAttribute('aria-hidden', 'false');
        } else {
          // Hide referral field and clear value
          referralField.style.display = 'none';
          referralField.setAttribute('aria-hidden', 'true');
          referralInput.value = '';

          // Clear from FormState (per pitfall #3 from research)
          if (typeof FormState !== 'undefined' && FormState.setFieldValue) {
            FormState.setFieldValue(4, 'referral-name', '');
          }
        }
      });
    }
  }

  /**
   * Attach input/blur event listeners to expense fields for real-time calculation.
   */
  function attachCalculationListeners() {
    var fieldIds = ['spese-condominio', 'imu', 'tari', 'utenze'];
    var i;

    for (i = 0; i < fieldIds.length; i++) {
      var field = document.getElementById(fieldIds[i]);
      if (field) {
        field.addEventListener('input', calculateAnnualTotal);
        field.addEventListener('blur', calculateAnnualTotal);
      }
    }
  }

  /**
   * Restore tracking field visibility state from saved session.
   */
  function restoreTrackingState() {
    var passaparolaRadio = document.getElementById('tracking-passaparola');
    var referralField = document.getElementById('referral-field');

    if (!passaparolaRadio || !referralField) {
      return;
    }

    if (passaparolaRadio.checked) {
      referralField.style.display = 'block';
      referralField.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Initialize step-specific logic.
   */
  function init() {
    attachCalculationListeners();
    handleTrackingSelection();
    restoreTrackingState();
    calculateAnnualTotal(); // Set initial value (handles session restore)
  }

  // Expose public API
  window.StepFields = {
    init: init,
    calculateTotal: calculateAnnualTotal
  };

}());

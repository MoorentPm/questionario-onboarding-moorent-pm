/**
 * StepReview - Review page population and edit navigation for Moorent Pm onboarding.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.StepReview.
 */
(function () {
  'use strict';

  /**
   * Format a date string to Italian DD/MM/YYYY format.
   * @param {string} dateString - ISO date string (YYYY-MM-DD)
   * @returns {string} Formatted date or em dash
   */
  function formatDate(dateString) {
    if (!dateString) {
      return '—';
    }
    try {
      var date = new Date(dateString);
      var formatter = new Intl.DateTimeFormat('it-IT');
      return formatter.format(date);
    } catch (e) {
      return '—';
    }
  }

  /**
   * Format a number as Italian currency (EUR).
   * @param {number|string} amount
   * @returns {string} Formatted currency or em dash
   */
  function formatCurrency(amount) {
    var numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount)) {
      return '—';
    }
    var formatter = new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    });
    return formatter.format(numAmount);
  }

  /**
   * Format address components into a single string.
   * @param {string} via
   * @param {string} civico
   * @param {string} cap
   * @param {string} citta
   * @param {string} provincia
   * @returns {string} Formatted address or em dash
   */
  function formatAddress(via, civico, cap, citta, provincia) {
    if (!via && !citta) {
      return '—';
    }

    var parts = [];
    if (via) {
      var viaStr = via;
      if (civico) {
        viaStr += ', ' + civico;
      }
      parts.push(viaStr);
    }
    if (cap && citta) {
      parts.push(cap + ' ' + citta);
    } else if (citta) {
      parts.push(citta);
    }
    if (provincia) {
      var lastIndex = parts.length - 1;
      if (lastIndex >= 0) {
        parts[lastIndex] += ' (' + provincia + ')';
      } else {
        parts.push('(' + provincia + ')');
      }
    }

    return parts.join(', ') || '—';
  }

  /**
   * Calculate total annual expenses from step 2 data.
   * @param {object} step2Data
   * @returns {number}
   */
  function calculateTotal(step2Data) {
    var speseCondominio = parseFloat(step2Data['spese-condominio']) || 0;
    var imu = parseFloat(step2Data['imu']) || 0;
    var tari = parseFloat(step2Data['tari']) || 0;
    var utenze = parseFloat(step2Data['utenze']) || 0;

    return (speseCondominio * 12) + imu + tari + (utenze * 12);
  }

  /**
   * Update document upload status badge.
   * @param {string} elementId - ID of the review element
   * @param {string} fileData - Base64 data URL from FormState (or null)
   * @param {string} filename - Filename from FormState (optional)
   */
  function updateDocumentStatus(elementId, fileData, filename) {
    var element = document.getElementById(elementId);
    if (!element) {
      return;
    }

    // Clear existing content and create fresh badge
    var badge = element.querySelector('.status-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'status-badge';
      element.innerHTML = '';
      element.appendChild(badge);
    }

    // fileData is a base64 data URL string (truthy) or null/undefined
    if (fileData) {
      badge.textContent = filename ? 'Caricato: ' + filename : 'Caricato';
      badge.className = 'status-badge status-uploaded';
    } else {
      badge.textContent = 'Mancante';
      badge.className = 'status-badge status-missing';
    }
  }

  /**
   * Populate review page with data from FormState.
   */
  function populate() {
    if (typeof FormState === 'undefined' || !FormState.getStepData) {
      console.warn('[StepReview] FormState not available');
      return;
    }

    var step1Data = FormState.getStepData(1);
    var step2Data = FormState.getStepData(2);
    var step3Data = FormState.getStepData(3);
    var step4Data = FormState.getStepData(4);

    // Step 1: Dati Personali
    var reviewNome = document.getElementById('review-nome');
    if (reviewNome) {
      reviewNome.textContent = step1Data.nome || '—';
    }

    var reviewCognome = document.getElementById('review-cognome');
    if (reviewCognome) {
      reviewCognome.textContent = step1Data.cognome || '—';
    }

    var reviewDataNascita = document.getElementById('review-data-nascita');
    if (reviewDataNascita) {
      reviewDataNascita.textContent = formatDate(step1Data['data-nascita']);
    }

    var reviewCf = document.getElementById('review-cf');
    if (reviewCf) {
      reviewCf.textContent = step1Data['codice-fiscale'] || '—';
    }

    var reviewIndirizzoResidenza = document.getElementById('review-indirizzo-residenza');
    if (reviewIndirizzoResidenza) {
      reviewIndirizzoResidenza.textContent = formatAddress(
        step1Data['via-residenza'],
        step1Data['civico-residenza'],
        step1Data['cap-residenza'],
        step1Data['citta-residenza'],
        step1Data['provincia-residenza']
      );
    }

    // Step 2: Dati Immobile
    var reviewIndirizzoImmobile = document.getElementById('review-indirizzo-immobile');
    if (reviewIndirizzoImmobile) {
      reviewIndirizzoImmobile.textContent = formatAddress(
        step2Data['via-immobile'],
        step2Data['civico-immobile'],
        step2Data['cap-immobile'],
        step2Data['citta-immobile'],
        step2Data['provincia-immobile']
      );
    }

    var reviewSpeseCondominio = document.getElementById('review-spese-condominio');
    if (reviewSpeseCondominio) {
      reviewSpeseCondominio.textContent = formatCurrency(step2Data['spese-condominio']);
    }

    var reviewImu = document.getElementById('review-imu');
    if (reviewImu) {
      reviewImu.textContent = formatCurrency(step2Data['imu']);
    }

    var reviewTari = document.getElementById('review-tari');
    if (reviewTari) {
      reviewTari.textContent = formatCurrency(step2Data['tari']);
    }

    var reviewUtenze = document.getElementById('review-utenze');
    if (reviewUtenze) {
      var utenzeValue = step2Data['utenze'];
      if (utenzeValue) {
        reviewUtenze.textContent = formatCurrency(utenzeValue);
      } else {
        reviewUtenze.textContent = 'Non specificato';
      }
    }

    var reviewTotale = document.getElementById('review-totale');
    if (reviewTotale) {
      var total = calculateTotal(step2Data);
      reviewTotale.textContent = formatCurrency(total);
    }

    // Step 2: Altre spese (optional field)
    var reviewAltreSpese = document.getElementById('review-altre-spese');
    if (reviewAltreSpese) {
      reviewAltreSpese.textContent = step2Data['altre-spese'] || '—';
    }

    // Step 3: Documenti
    updateDocumentStatus('review-doc-fronte', step3Data['documento-fronte'], step3Data['documento-fronte-filename']);
    updateDocumentStatus('review-doc-retro', step3Data['documento-retro'], step3Data['documento-retro-filename']);

    // Step 4: Tracking
    var reviewTracking = document.getElementById('review-tracking');
    if (reviewTracking) {
      reviewTracking.textContent = step4Data['tracking-source'] || '—';
    }

    var reviewReferral = document.getElementById('review-referral');
    if (reviewReferral) {
      var referralValue = step4Data['referral-name'];
      reviewReferral.textContent = referralValue || '—';

      // Hide referral dt+dd pair if tracking source is not Passaparola
      var trackingSource = step4Data['tracking-source'];
      if (trackingSource !== 'Passaparola') {
        var referralDt = reviewReferral.previousElementSibling;
        if (referralDt && referralDt.tagName === 'DT') {
          referralDt.style.display = 'none';
          reviewReferral.style.display = 'none';
        }
      } else {
        var referralDt2 = reviewReferral.previousElementSibling;
        if (referralDt2 && referralDt2.tagName === 'DT') {
          referralDt2.style.display = '';
          reviewReferral.style.display = '';
        }
      }
    }
  }

  /**
   * Attach click listeners to edit buttons.
   */
  function attachEditButtons() {
    var editButtons = document.querySelectorAll('.btn-edit');
    var i;

    for (i = 0; i < editButtons.length; i++) {
      editButtons[i].addEventListener('click', function () {
        var targetStep = parseInt(this.getAttribute('data-edit-step'), 10);
        if (!isNaN(targetStep) && typeof FormNav !== 'undefined' && FormNav.showStep) {
          FormNav.showStep(targetStep);
        }
      });
    }
  }

  /**
   * Initialize review page logic.
   */
  function init() {
    attachEditButtons();
  }

  // Expose public API
  window.StepReview = {
    populate: populate,
    init: init
  };

}());

/**
 * CodiceFiscale - Codice Fiscale validation module for Moorent Pm onboarding questionnaire.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.CodiceFiscale.
 *
 * Features:
 * - Auto-uppercase on input
 * - Length, format, checksum validation
 * - Cross-validation with personal data (nome, cognome, data di nascita)
 * - Italian error messages
 * - Graceful fallback when @marketto/codice-fiscale-utils CDN not loaded
 */
(function () {
  'use strict';

  // Checksum lookup tables for manual validation fallback
  var ODD_VALUES = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
  };

  var EVEN_VALUES = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
    'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
  };

  // CF format regex: 6 letters + 2 digits + 1 letter + 2 digits + 1 letter + 3 digits + 1 letter
  var CF_FORMAT_REGEX = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;

  /**
   * Calculate checksum character using manual algorithm
   * @param {string} cf - First 15 characters of CF
   * @returns {string} Expected check character (A-Z)
   */
  function calculateChecksum(cf) {
    var sum = 0;
    for (var i = 0; i < 15; i++) {
      var char = cf[i];
      // Odd positions are 1-indexed (1st, 3rd, 5th...) = indices 0, 2, 4...
      if (i % 2 === 0) {
        sum += ODD_VALUES[char];
      } else {
        sum += EVEN_VALUES[char];
      }
    }
    var remainder = sum % 26;
    // Map 0-25 to A-Z
    return String.fromCharCode(65 + remainder);
  }

  /**
   * Validate CF checksum
   * @param {string} cf - Complete 16-character CF
   * @returns {boolean} True if checksum is valid
   */
  function validateChecksum(cf) {
    // Try library first if available
    if (typeof CodiceFiscaleUtils !== 'undefined' && CodiceFiscaleUtils.Validator) {
      try {
        return CodiceFiscaleUtils.Validator.codiceFiscale(cf).valid;
      } catch (e) {
        console.warn('[CodiceFiscale] Library validation failed, using manual checksum:', e.message);
      }
    }

    // Manual fallback
    var expectedCheck = calculateChecksum(cf.substring(0, 15));
    return cf[15] === expectedCheck;
  }

  /**
   * Extract consonants from a string
   * @param {string} str
   * @returns {string} Consonants in uppercase
   */
  function extractConsonants(str) {
    if (!str) return '';
    return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
  }

  /**
   * Extract vowels from a string
   * @param {string} str
   * @returns {string} Vowels in uppercase
   */
  function extractVowels(str) {
    if (!str) return '';
    return str.toUpperCase().replace(/[^AEIOU]/g, '');
  }

  /**
   * Encode surname for CF (positions 0-2)
   * @param {string} surname
   * @returns {string} 3-character encoded surname
   */
  function encodeSurname(surname) {
    var consonants = extractConsonants(surname);
    var vowels = extractVowels(surname);
    var encoded = consonants + vowels + 'XXX';
    return encoded.substring(0, 3);
  }

  /**
   * Encode name for CF (positions 3-5)
   * @param {string} name
   * @returns {string} 3-character encoded name
   */
  function encodeName(name) {
    var consonants = extractConsonants(name);
    var vowels = extractVowels(name);

    // Special rule: if 4+ consonants, take 1st, 3rd, 4th
    if (consonants.length >= 4) {
      return consonants[0] + consonants[2] + consonants[3];
    }

    // Otherwise: take up to 3 consonants, then vowels, then X padding
    var encoded = consonants + vowels + 'XXX';
    return encoded.substring(0, 3);
  }

  /**
   * Cross-validate CF with personal data
   * @param {string} cf - Complete 16-character CF
   * @param {object} personalData - { nome, cognome, dataNascita }
   * @returns {boolean} True if CF matches personal data
   */
  function crossValidate(cf, personalData) {
    if (!personalData.nome || !personalData.cognome || !personalData.dataNascita) {
      // Cannot cross-validate without all fields
      return true;
    }

    // Try library first if available
    if (typeof CodiceFiscaleUtils !== 'undefined' && CodiceFiscaleUtils.Pattern) {
      try {
        var pattern = CodiceFiscaleUtils.Pattern;

        // Check surname encoding (positions 0-2)
        var surnamePattern = pattern.codiceFiscale({ surname: personalData.cognome });
        if (surnamePattern && cf.substring(0, 3) !== surnamePattern.substring(0, 3)) {
          return false;
        }

        // Check name encoding (positions 3-5)
        var namePattern = pattern.codiceFiscale({ name: personalData.nome });
        if (namePattern && cf.substring(3, 6) !== namePattern.substring(3, 6)) {
          return false;
        }

        return true;
      } catch (e) {
        console.warn('[CodiceFiscale] Library cross-validation failed, using manual:', e.message);
      }
    }

    // Manual fallback: partial cross-validation
    var expectedSurname = encodeSurname(personalData.cognome);
    var expectedName = encodeName(personalData.nome);

    var cfSurname = cf.substring(0, 3);
    var cfName = cf.substring(3, 6);

    return cfSurname === expectedSurname && cfName === expectedName;
  }

  /**
   * Validate CF field on blur
   * @param {string} cfFieldId - ID of CF input field
   * @param {object} personalDataIds - { nome, cognome, dataNascita } field IDs
   */
  function validateField(cfFieldId, personalDataIds) {
    var field = document.getElementById(cfFieldId);
    if (!field) {
      console.warn('[CodiceFiscale] Field not found:', cfFieldId);
      return;
    }

    var cf = field.value.trim();

    // 1. Empty check
    if (!cf && field.hasAttribute('required')) {
      field.setCustomValidity('Questo campo e obbligatorio');
      window.FormValidation.showError(field, 'Questo campo e obbligatorio');
      return;
    }

    if (!cf) {
      // Empty but not required
      field.setCustomValidity('');
      window.FormValidation.clearError(field);
      return;
    }

    // 2. Length check
    if (cf.length !== 16) {
      field.setCustomValidity('Deve avere 16 caratteri');
      window.FormValidation.showError(field, 'Deve avere 16 caratteri');
      return;
    }

    // 3. Format check
    if (!CF_FORMAT_REGEX.test(cf)) {
      field.setCustomValidity('Formato non corretto');
      window.FormValidation.showError(field, 'Formato non corretto');
      return;
    }

    // 4. Checksum validation
    if (!validateChecksum(cf)) {
      field.setCustomValidity('Carattere di controllo non valido');
      window.FormValidation.showError(field, 'Carattere di controllo non valido');
      return;
    }

    // 5. Cross-validation with personal data (warning only, not blocking)
    if (personalDataIds) {
      var nomeField = document.getElementById(personalDataIds.nome);
      var cognomeField = document.getElementById(personalDataIds.cognome);
      var dataNascitaField = document.getElementById(personalDataIds.dataNascita);

      var personalData = {
        nome: nomeField ? nomeField.value.trim() : '',
        cognome: cognomeField ? cognomeField.value.trim() : '',
        dataNascita: dataNascitaField ? dataNascitaField.value.trim() : ''
      };

      if (personalData.nome && personalData.cognome && personalData.dataNascita) {
        if (!crossValidate(cf, personalData)) {
          // Warning (not blocking) - do NOT call setCustomValidity
          // Use a different CSS class for warnings
          var warningMessage = 'Il Codice Fiscale non corrisponde ai dati personali inseriti';

          // Ensure field has an ID for aria-describedby
          if (!field.id) {
            field.id = 'field-' + Math.random().toString(36).substr(2, 9);
          }

          var warningId = field.id + '-warning';
          var existingWarning = document.getElementById(warningId);

          if (existingWarning) {
            existingWarning.textContent = warningMessage;
          } else {
            var warningEl = document.createElement('span');
            warningEl.id = warningId;
            warningEl.className = 'field-warning';
            warningEl.setAttribute('role', 'alert');
            warningEl.textContent = warningMessage;

            // Insert after the field (or after existing error if present)
            var errorId = field.id + '-error';
            var existingError = document.getElementById(errorId);
            if (existingError) {
              field.parentNode.insertBefore(warningEl, existingError.nextSibling);
            } else {
              field.parentNode.insertBefore(warningEl, field.nextSibling);
            }
          }

          // Do NOT set aria-invalid or custom validity - this is a warning, not an error
          return;
        }
      }
    }

    // 6. Valid - clear all errors and warnings
    field.setCustomValidity('');
    window.FormValidation.clearError(field);

    // Also remove any warning
    if (field.id) {
      var warningId = field.id + '-warning';
      var warningEl = document.getElementById(warningId);
      if (warningEl) {
        warningEl.remove();
      }
    }
  }

  /**
   * Initialize CF field with auto-uppercase and validation
   * @param {string} cfFieldId - ID of CF input field
   * @param {object} personalDataIds - { nome, cognome, dataNascita } field IDs
   */
  function init(cfFieldId, personalDataIds) {
    var field = document.getElementById(cfFieldId);
    if (!field) {
      console.warn('[CodiceFiscale] Field not found:', cfFieldId);
      return;
    }

    // Check if library is loaded
    if (typeof CodiceFiscaleUtils === 'undefined') {
      console.warn('[CodiceFiscale] @marketto/codice-fiscale-utils not loaded. Using manual validation fallback.');
    }

    // Auto-uppercase on input (only validation that fires on input, not blur)
    field.addEventListener('input', function () {
      field.value = field.value.toUpperCase();
    });

    // Blur validation
    field.addEventListener('blur', function () {
      validateField(cfFieldId, personalDataIds);
    });

    // Re-validation when personal data fields change
    if (personalDataIds) {
      ['nome', 'cognome', 'dataNascita'].forEach(function (key) {
        var otherField = document.getElementById(personalDataIds[key]);
        if (otherField) {
          otherField.addEventListener('change', function () {
            // Only re-validate CF if it has a value
            if (field.value.trim()) {
              validateField(cfFieldId, personalDataIds);
            }
          });
        }
      });
    }
  }

  /**
   * Pure validation function (for use by other modules)
   * @param {string} cfValue - CF string to validate
   * @returns {object} { valid: boolean, error: string|null, warning: string|null }
   */
  function validate(cfValue) {
    var cf = cfValue ? cfValue.trim() : '';

    // Empty check (assume required for pure validation)
    if (!cf) {
      return { valid: false, error: 'Questo campo e obbligatorio', warning: null };
    }

    // Length check
    if (cf.length !== 16) {
      return { valid: false, error: 'Deve avere 16 caratteri', warning: null };
    }

    // Format check
    if (!CF_FORMAT_REGEX.test(cf)) {
      return { valid: false, error: 'Formato non corretto', warning: null };
    }

    // Checksum validation
    if (!validateChecksum(cf)) {
      return { valid: false, error: 'Carattere di controllo non valido', warning: null };
    }

    return { valid: true, error: null, warning: null };
  }

  // Expose public API
  window.CodiceFiscale = {
    init: init,
    validate: validate
  };

}());

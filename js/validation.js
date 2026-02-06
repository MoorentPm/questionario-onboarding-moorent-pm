(function () {
  'use strict';

  /**
   * Core form validation engine
   * Validates fields on blur, displays inline Italian error messages
   * Provides public API for other modules (showError, clearError, validateStep)
   */

  // Italian error messages
  const ERROR_MESSAGES = {
    valueMissing: 'Questo campo e obbligatorio',
    typeMismatchEmail: 'Inserisci un indirizzo email valido',
    typeMismatchTel: 'Inserisci un numero di telefono valido',
    patternMismatch: 'Formato non valido',
    tooShort: 'Inserisci almeno {minLength} caratteri',
    tooLong: 'Massimo {maxLength} caratteri consentiti',
    rangeUnderflow: 'Il valore minimo e {min}',
    rangeOverflow: 'Il valore massimo e {max}',
    default: 'Questo campo non e valido'
  };

  /**
   * Generate error message based on field validity state
   * @param {HTMLElement} field - Form field element
   * @returns {string} Italian error message
   */
  function getErrorMessage(field) {
    const validity = field.validity;

    if (validity.valueMissing) {
      return ERROR_MESSAGES.valueMissing;
    }

    if (validity.typeMismatch) {
      if (field.type === 'email') {
        return ERROR_MESSAGES.typeMismatchEmail;
      }
      if (field.type === 'tel') {
        return ERROR_MESSAGES.typeMismatchTel;
      }
    }

    if (validity.patternMismatch) {
      // Check for custom error message in data attribute
      return field.dataset.errorMessage || ERROR_MESSAGES.patternMismatch;
    }

    if (validity.tooShort) {
      return ERROR_MESSAGES.tooShort.replace('{minLength}', field.minLength);
    }

    if (validity.tooLong) {
      return ERROR_MESSAGES.tooLong.replace('{maxLength}', field.maxLength);
    }

    if (validity.rangeUnderflow) {
      return ERROR_MESSAGES.rangeUnderflow.replace('{min}', field.min);
    }

    if (validity.rangeOverflow) {
      return ERROR_MESSAGES.rangeOverflow.replace('{max}', field.max);
    }

    return ERROR_MESSAGES.default;
  }

  /**
   * Show error message for a field
   * @param {HTMLElement} field - Form field element
   * @param {string} message - Error message to display
   */
  function showError(field, message) {
    // Ensure field has an ID for aria-describedby
    if (!field.id) {
      field.id = 'field-' + Math.random().toString(36).substr(2, 9);
    }

    const errorId = field.id + '-error';
    let errorEl = document.getElementById(errorId);

    // Update existing error or create new one
    if (errorEl) {
      errorEl.textContent = message;
    } else {
      errorEl = document.createElement('span');
      errorEl.id = errorId;
      errorEl.className = 'field-error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = message;

      // Insert after the field
      field.parentNode.insertBefore(errorEl, field.nextSibling);
    }

    // Set ARIA attributes for accessibility
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', errorId);

    // Add visual error styling
    field.classList.add('input-error');
  }

  /**
   * Clear error message for a field
   * @param {HTMLElement} field - Form field element
   */
  function clearError(field) {
    if (!field.id) {
      return;
    }

    const errorId = field.id + '-error';
    const errorEl = document.getElementById(errorId);

    if (errorEl) {
      errorEl.remove();
    }

    // Clear ARIA attributes
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');

    // Remove visual error styling
    field.classList.remove('input-error');

    // Clear custom validity
    field.setCustomValidity('');
  }

  /**
   * Validate a single field
   * @param {HTMLElement} field - Form field element
   * @returns {boolean} True if valid, false if invalid
   */
  function validateField(field) {
    // Clear any previous custom validity
    field.setCustomValidity('');

    // Check native validity
    if (field.checkValidity()) {
      clearError(field);
      return true;
    }

    // Field is invalid - get and show error message
    const errorMessage = getErrorMessage(field);
    field.setCustomValidity(errorMessage);
    showError(field, errorMessage);
    return false;
  }

  /**
   * Validate all fields in a step (without showing errors)
   * @param {number} stepIndex - Step index to validate
   * @returns {boolean} True if all fields valid, false if any invalid
   */
  function validateStep(stepIndex) {
    const stepEl = document.querySelector('.form-step[data-step="' + stepIndex + '"]');
    if (!stepEl) {
      return true;
    }

    const fields = stepEl.querySelectorAll('input, select, textarea');
    let allValid = true;

    fields.forEach(function (field) {
      // Clear previous custom validity
      field.setCustomValidity('');

      if (!field.checkValidity()) {
        allValid = false;
      }
    });

    return allValid;
  }

  /**
   * Validate all fields in a step and show errors
   * @param {number} stepIndex - Step index to validate
   * @returns {boolean} True if all fields valid, false if any invalid
   */
  function showStepErrors(stepIndex) {
    const stepEl = document.querySelector('.form-step[data-step="' + stepIndex + '"]');
    if (!stepEl) {
      return true;
    }

    const fields = stepEl.querySelectorAll('input, select, textarea');
    let allValid = true;

    fields.forEach(function (field) {
      if (!validateField(field)) {
        allValid = false;
      }
    });

    // Scroll to first error if any
    if (!allValid) {
      const firstError = stepEl.querySelector('.field-error');
      if (firstError) {
        // Get the associated field (remove '-error' from ID)
        const fieldId = firstError.id.replace('-error', '');
        const field = document.getElementById(fieldId);

        if (field) {
          // Scroll to field with offset
          const fieldTop = field.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({
            top: fieldTop - 100,
            behavior: 'smooth'
          });

          // Focus field after scroll animation
          setTimeout(function () {
            field.focus();
          }, 400);
        }
      }
    }

    return allValid;
  }

  /**
   * Initialize validation event listeners
   */
  function init() {
    const formContainer = document.querySelector('main.form-container');
    if (!formContainer) {
      console.error('FormValidation: main.form-container not found');
      return;
    }

    // Attach blur event with useCapture=true (blur doesn't bubble)
    formContainer.addEventListener('blur', function (e) {
      const target = e.target;

      // Only validate form fields
      if (target.matches('input, select, textarea')) {
        validateField(target);
      }
    }, true); // useCapture=true for blur delegation
  }

  // Public API
  window.FormValidation = {
    init: init,
    validateField: validateField,
    clearError: clearError,
    showError: showError,
    validateStep: validateStep,
    showStepErrors: showStepErrors
  };

}());

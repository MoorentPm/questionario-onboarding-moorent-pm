/**
 * FormState - Centralized state management module for Moorent Pm onboarding questionnaire.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.FormState.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'moorent-onboarding-state';

  var defaultState = {
    currentStep: 0,
    formData: {
      step0: {},  // Benvenuto
      step1: {},  // Dati Personali
      step2: {},  // Dati Immobile
      step3: {},  // Documenti
      step4: {},  // Tracking & Note
      step5: {},  // Riepilogo
      step6: {}   // Privacy & Invio
    },
    totalSteps: 7,
    lastUpdated: null
  };

  // Internal state - deep copy of default to prevent mutation
  var state = JSON.parse(JSON.stringify(defaultState));

  // Track localStorage availability
  var localStorageAvailable = true;

  /**
   * Check if an error is a QuotaExceededError.
   * @param {Error} e
   * @returns {boolean}
   */
  function isQuotaExceeded(e) {
    var isQuotaError = false;
    if (e) {
      // Standard check
      if (e.code) {
        switch (e.code) {
          case 22:
            isQuotaError = true;
            break;
          // Firefox
          case 1014:
            if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
              isQuotaError = true;
            }
            break;
        }
      } else if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        isQuotaError = true;
      }
    }
    return isQuotaError;
  }

  /**
   * Test localStorage availability once at startup.
   */
  function testLocalStorage() {
    try {
      var testKey = '__moorent_ls_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      localStorageAvailable = true;
    } catch (e) {
      localStorageAvailable = false;
      if (e.name === 'SecurityError') {
        console.warn('[FormState] localStorage unavailable (SecurityError - private browsing?). Using in-memory state only.');
      } else {
        console.warn('[FormState] localStorage unavailable:', e.message, '. Using in-memory state only.');
      }
    }
  }

  /**
   * Load state from localStorage.
   * @returns {boolean} true if a valid session was found and loaded
   */
  function loadState() {
    if (!localStorageAvailable) {
      return false;
    }
    try {
      var serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized === null) {
        return false;
      }
      var parsed = JSON.parse(serialized);
      // Validate basic structure
      if (!parsed || typeof parsed !== 'object' || !parsed.formData) {
        console.warn('[FormState] Corrupted state found in localStorage. Removing.');
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
      state = parsed;
      return true;
    } catch (e) {
      console.warn('[FormState] Failed to load state from localStorage:', e.message);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        // Ignore removal errors
      }
      return false;
    }
  }

  /**
   * Save state to localStorage.
   * @returns {boolean} true if saved successfully
   */
  function saveState() {
    state.lastUpdated = new Date().toISOString();
    if (!localStorageAvailable) {
      return false;
    }
    try {
      var serialized = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (e) {
      if (isQuotaExceeded(e)) {
        console.warn('[FormState] localStorage quota exceeded. State only in memory for this session.');
        localStorageAvailable = false;
      } else {
        console.warn('[FormState] Failed to save state to localStorage:', e.message);
      }
      return false;
    }
  }

  /**
   * Get a deep copy of the current state.
   * @returns {object}
   */
  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Get the current step index.
   * @returns {number}
   */
  function getCurrentStep() {
    return state.currentStep;
  }

  /**
   * Set the current step and persist.
   * @param {number} step
   */
  function setCurrentStep(step) {
    if (typeof step !== 'number' || step < 0 || step >= state.totalSteps) {
      console.warn('[FormState] setCurrentStep: invalid step value:', step);
      return;
    }
    state.currentStep = step;
    saveState();
  }

  /**
   * Get data for a specific step.
   * @param {number} stepIndex
   * @returns {object}
   */
  function getStepData(stepIndex) {
    var key = 'step' + stepIndex;
    if (!state.formData[key]) {
      return {};
    }
    return JSON.parse(JSON.stringify(state.formData[key]));
  }

  /**
   * Set a single field value within a step and persist.
   * @param {number} stepIndex
   * @param {string} fieldName
   * @param {*} value
   */
  function setFieldValue(stepIndex, fieldName, value) {
    var key = 'step' + stepIndex;
    if (!state.formData[key]) {
      state.formData[key] = {};
    }
    state.formData[key][fieldName] = value;
    saveState();
  }

  /**
   * Bulk update a step's data and persist.
   * @param {number} stepIndex
   * @param {object} data
   */
  function setStepData(stepIndex, data) {
    if (!data || typeof data !== 'object') {
      console.warn('[FormState] setStepData: data must be an object');
      return;
    }
    var key = 'step' + stepIndex;
    state.formData[key] = JSON.parse(JSON.stringify(data));
    saveState();
  }

  /**
   * Clear state from localStorage and reset to default.
   */
  function clearState() {
    state = JSON.parse(JSON.stringify(defaultState));
    if (!localStorageAvailable) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[FormState] Failed to clear state from localStorage:', e.message);
    }
  }

  /**
   * Check if a valid session exists in localStorage.
   * @returns {boolean}
   */
  function hasExistingSession() {
    if (!localStorageAvailable) {
      return false;
    }
    try {
      var serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized === null) {
        return false;
      }
      var parsed = JSON.parse(serialized);
      return !!(parsed && typeof parsed === 'object' && parsed.formData);
    } catch (e) {
      return false;
    }
  }

  // Initialize: test localStorage, then attempt to load persisted state
  testLocalStorage();
  loadState();

  // Expose public API
  window.FormState = {
    getState: getState,
    getCurrentStep: getCurrentStep,
    setCurrentStep: setCurrentStep,
    getStepData: getStepData,
    setFieldValue: setFieldValue,
    setStepData: setStepData,
    loadState: loadState,
    saveState: saveState,
    clearState: clearState,
    hasExistingSession: hasExistingSession
  };

}());

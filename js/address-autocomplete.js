/**
 * AddressAutocomplete - Google Places address autocomplete module for Moorent Pm onboarding questionnaire.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.AddressAutocomplete.
 *
 * Features:
 * - Google Places Autocomplete Widget integration
 * - Italy-only restriction (componentRestrictions: { country: 'it' })
 * - Auto-populates Via, Civico, CAP, Citta, Provincia fields
 * - Session token billing optimization
 * - Auto-saves to FormState and triggers validation clearing
 * - Graceful degradation when API key missing or Google Maps not loaded
 */
(function () {
  'use strict';

  // Internal registry for address fields (populated before API loads)
  var registry = [];

  /**
   * Extract structured address data from Google Places address_components
   * @param {Array} components - Google Places address_components array
   * @returns {object} { street_number, route, locality, administrative_area_level_2, postal_code }
   */
  function extractAddressComponents(components) {
    var data = {
      street_number: '',
      route: '',
      locality: '',
      administrative_area_level_2: '',
      postal_code: ''
    };

    if (!components || !Array.isArray(components)) {
      return data;
    }

    components.forEach(function (component) {
      var types = component.types || [];

      if (types.indexOf('street_number') !== -1) {
        data.street_number = component.long_name || '';
      } else if (types.indexOf('route') !== -1) {
        data.route = component.long_name || '';
      } else if (types.indexOf('locality') !== -1) {
        data.locality = component.long_name || '';
      } else if (types.indexOf('administrative_area_level_2') !== -1) {
        // Use short_name for province code (e.g., "RM", "MI")
        data.administrative_area_level_2 = component.short_name || '';
      } else if (types.indexOf('postal_code') !== -1) {
        data.postal_code = component.long_name || '';
      }
    });

    return data;
  }

  /**
   * Initialize autocomplete on a single address field
   * @param {string} inputId - ID of the Via/address search input field
   * @param {object} componentIds - { via, civico, cap, citta, provincia } field IDs
   * @param {number} stepIndex - data-step index for FormState auto-save
   */
  function initAutocomplete(inputId, componentIds, stepIndex) {
    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('[AddressAutocomplete] Google Maps API not loaded. Autocomplete disabled for:', inputId);
      return;
    }

    var input = document.getElementById(inputId);
    if (!input) {
      console.warn('[AddressAutocomplete] Input field not found:', inputId);
      return;
    }

    // Create session token for billing optimization
    var sessionToken = new google.maps.places.AutocompleteSessionToken();

    // Initialize autocomplete widget
    var autocomplete = new google.maps.places.Autocomplete(input, {
      types: ['address'],
      componentRestrictions: { country: 'it' },
      fields: ['address_components'],
      sessionToken: sessionToken
    });

    // Listen for place selection
    autocomplete.addListener('place_changed', function () {
      var place = autocomplete.getPlace();

      if (!place || !place.address_components) {
        console.warn('[AddressAutocomplete] No address components in selected place');
        return;
      }

      // Extract address data
      var addressData = extractAddressComponents(place.address_components);

      // Populate component fields
      var fieldMappings = [
        { componentKey: 'via', dataKey: 'route' },
        { componentKey: 'civico', dataKey: 'street_number' },
        { componentKey: 'cap', dataKey: 'postal_code' },
        { componentKey: 'citta', dataKey: 'locality' },
        { componentKey: 'provincia', dataKey: 'administrative_area_level_2' }
      ];

      fieldMappings.forEach(function (mapping) {
        var fieldId = componentIds[mapping.componentKey];
        if (!fieldId) return;

        var field = document.getElementById(fieldId);
        if (!field) return;

        var value = addressData[mapping.dataKey] || '';
        field.value = value;

        // Save to FormState
        if (typeof window.FormState !== 'undefined') {
          window.FormState.setFieldValue(stepIndex, field.name || fieldId, value);
        }

        // Dispatch change event for event delegation (app.js auto-save)
        var changeEvent = new Event('change', { bubbles: true });
        field.dispatchEvent(changeEvent);

        // Clear validation errors on populated fields
        if (typeof window.FormValidation !== 'undefined') {
          window.FormValidation.clearError(field);
        }
      });

      // Regenerate session token after place selection (billing optimization)
      sessionToken = new google.maps.places.AutocompleteSessionToken();
      autocomplete.setOptions({ sessionToken: sessionToken });
    });

    console.log('[AddressAutocomplete] Initialized for:', inputId);
  }

  /**
   * Register an address field for autocomplete (may be called before API loads)
   * @param {string} inputId - ID of the Via/address search input field
   * @param {object} componentIds - { via, civico, cap, citta, provincia } field IDs
   * @param {number} stepIndex - data-step index for FormState auto-save
   */
  function init(inputId, componentIds, stepIndex) {
    // Store in registry for later initialization
    registry.push({
      inputId: inputId,
      componentIds: componentIds,
      stepIndex: stepIndex
    });

    // Try to initialize immediately if API already loaded
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      initAutocomplete(inputId, componentIds, stepIndex);
    }
  }

  /**
   * Initialize all registered address fields (called after API loads)
   */
  function initAll() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('[AddressAutocomplete] Cannot initAll - Google Maps API not loaded');
      return;
    }

    console.log('[AddressAutocomplete] Initializing all registered fields:', registry.length);

    registry.forEach(function (config) {
      initAutocomplete(config.inputId, config.componentIds, config.stepIndex);
    });
  }

  /**
   * Load Google Maps JavaScript API dynamically
   */
  function loadApi() {
    // Check if API key is configured
    if (typeof window.CONFIG === 'undefined' || !window.CONFIG.googleMapsApiKey) {
      console.warn('[AddressAutocomplete] Google Maps API key not configured. Autocomplete disabled.');
      return;
    }

    // Check if already loaded
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      console.log('[AddressAutocomplete] Google Maps API already loaded');
      initAll();
      return;
    }

    // Define global callback
    window._initAddressAutocomplete = function () {
      console.log('[AddressAutocomplete] Google Maps API loaded via callback');
      if (typeof window.AddressAutocomplete !== 'undefined' && window.AddressAutocomplete.initAll) {
        window.AddressAutocomplete.initAll();
      }
    };

    // Create script tag
    var script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' +
      encodeURIComponent(window.CONFIG.googleMapsApiKey) +
      '&libraries=places&callback=_initAddressAutocomplete';
    script.async = true;
    script.defer = true;

    script.onerror = function () {
      console.error('[AddressAutocomplete] Failed to load Google Maps API');
    };

    document.head.appendChild(script);
    console.log('[AddressAutocomplete] Loading Google Maps API...');
  }

  // Expose public API
  window.AddressAutocomplete = {
    init: init,
    loadApi: loadApi,
    initAll: initAll
  };

}());

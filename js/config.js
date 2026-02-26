/**
 * CONFIG - API configuration module for Moorent Pm onboarding questionnaire.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.CONFIG.
 *
 * - appsScriptUrl:
 *   The Google Apps Script Web App URL that receives form submissions.
 *   To update: Deploy > Manage deployments > Web app URL
 *
 * - googleMapsApiKey:
 *   Google Maps JavaScript API key with Places API enabled.
 *   Used for address autocomplete in Via/address fields.
 *   Leave empty to disable autocomplete (form remains functional).
 */
(function () {
  'use strict';

  window.CONFIG = {
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbykmObsFttYOMAX83gUja01Y7S_Y3RAojjIs39wwa-hVPQ-bngE550YPQsJGNzEX5SN/exec',
    googleMapsApiKey: 'AIzaSyA3OpTFG4-WupXL659tUlhmFN3HCd9eTGo'
  };

}());

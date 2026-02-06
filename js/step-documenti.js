/**
 * StepDocumenti - Document upload interactivity for Moorent Pm onboarding.
 * Handles drag-and-drop, FileReader base64 conversion, validation, preview, and state persistence.
 * Uses IIFE to avoid polluting global scope. Exposes public API on window.StepDocumenti.
 */
(function () {
  'use strict';

  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  var MAX_SIZE_IMAGE = 5 * 1024 * 1024; // 5MB
  var MAX_SIZE_PDF = 10 * 1024 * 1024;  // 10MB
  var TARGETS = ['fronte', 'retro'];

  /**
   * Validate file type and size.
   * @param {File} file
   * @returns {object} { valid: boolean, error?: string }
   */
  function validateFile(file) {
    // Check MIME type
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      return {
        valid: false,
        error: 'Formato non supportato. Usa JPG, PNG o PDF.'
      };
    }

    // Check size based on type
    var maxSize = (file.type === 'application/pdf') ? MAX_SIZE_PDF : MAX_SIZE_IMAGE;
    if (file.size > maxSize) {
      var maxMB = (file.type === 'application/pdf') ? 10 : 5;
      return {
        valid: false,
        error: 'File troppo grande. Massimo ' + maxMB + 'MB.'
      };
    }

    return { valid: true };
  }

  /**
   * Format file size as human-readable string.
   * @param {number} bytes
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
      var kb = Math.round(bytes / 1024);
      return kb + ' KB';
    } else {
      var mb = (bytes / (1024 * 1024)).toFixed(1);
      return mb + ' MB';
    }
  }

  /**
   * Read file as Data URL using FileReader.
   * @param {File} file
   * @param {function} callback - (error, dataUrl)
   */
  function readFileAsDataURL(file, callback) {
    var reader = new FileReader();

    reader.onload = function (e) {
      callback(null, e.target.result);
    };

    reader.onerror = function () {
      callback(new Error('Errore durante la lettura del file'));
    };

    reader.readAsDataURL(file);
  }

  /**
   * Show preview UI for uploaded file.
   * @param {string} target - 'fronte' or 'retro'
   * @param {string} dataUrl - Base64 data URL
   * @param {string} filename
   * @param {number} fileSize - Size in bytes
   * @param {string} fileType - MIME type
   */
  function showPreview(target, dataUrl, filename, fileSize, fileType) {
    var previewContainer = document.getElementById('preview-' + target);
    var thumbContainer = document.getElementById('thumb-' + target);
    var filenameElement = document.getElementById('filename-' + target);
    var filesizeElement = document.getElementById('filesize-' + target);
    var uploadZone = document.querySelector('.upload-zone[data-upload-target="' + target + '"]');

    if (!previewContainer || !thumbContainer || !filenameElement || !filesizeElement || !uploadZone) {
      return;
    }

    // Clear thumbnail container
    thumbContainer.innerHTML = '';

    // Create preview based on file type
    if (fileType === 'application/pdf') {
      // Create generic document SVG icon
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '48');
      svg.setAttribute('height', '48');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', '#e53935');
      svg.setAttribute('aria-hidden', 'true');

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z');

      svg.appendChild(path);
      thumbContainer.appendChild(svg);
    } else {
      // Create image thumbnail
      var img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Anteprima documento';
      img.style.maxWidth = '160px';
      img.style.maxHeight = '120px';
      img.style.objectFit = 'cover';
      thumbContainer.appendChild(img);
    }

    // Set filename and file size
    filenameElement.textContent = filename;
    filesizeElement.textContent = formatFileSize(fileSize);

    // Toggle upload zone state
    uploadZone.classList.add('has-file');
  }

  /**
   * Handle file upload - validate, read, store, and preview.
   * @param {File} file
   * @param {string} target - 'fronte' or 'retro'
   */
  function handleFile(file, target) {
    var errorElement = document.getElementById('error-' + target);
    var fileInput = document.getElementById('file-' + target);

    // Validate file
    var validation = validateFile(file);
    if (!validation.valid) {
      if (errorElement) {
        errorElement.textContent = validation.error;
        errorElement.style.display = 'block';
      }
      return;
    }

    // Clear any previous error
    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }

    // Read file as base64 data URL
    readFileAsDataURL(file, function (error, dataUrl) {
      if (error) {
        if (errorElement) {
          errorElement.textContent = error.message;
          errorElement.style.display = 'block';
        }
        return;
      }

      // Store in FormState (step index 3)
      if (typeof FormState !== 'undefined' && FormState.setFieldValue) {
        FormState.setFieldValue(3, 'documento-' + target, dataUrl);
        FormState.setFieldValue(3, 'documento-' + target + '-filename', file.name);
        FormState.setFieldValue(3, 'documento-' + target + '-size', file.size);
        FormState.setFieldValue(3, 'documento-' + target + '-type', file.type);
      }

      // Show preview
      showPreview(target, dataUrl, file.name, file.size, file.type);

      // Reset file input to allow re-selecting same file
      if (fileInput) {
        fileInput.value = '';
      }
    });
  }

  /**
   * Remove uploaded file and reset UI.
   * @param {string} target - 'fronte' or 'retro'
   */
  function removeFile(target) {
    var uploadZone = document.querySelector('.upload-zone[data-upload-target="' + target + '"]');
    var thumbContainer = document.getElementById('thumb-' + target);
    var filenameElement = document.getElementById('filename-' + target);
    var filesizeElement = document.getElementById('filesize-' + target);
    var fileInput = document.getElementById('file-' + target);
    var errorElement = document.getElementById('error-' + target);

    // Clear FormState
    if (typeof FormState !== 'undefined' && FormState.setFieldValue) {
      FormState.setFieldValue(3, 'documento-' + target, null);
      FormState.setFieldValue(3, 'documento-' + target + '-filename', null);
      FormState.setFieldValue(3, 'documento-' + target + '-size', null);
      FormState.setFieldValue(3, 'documento-' + target + '-type', null);
    }

    // Reset UI
    if (uploadZone) {
      uploadZone.classList.remove('has-file');
    }
    if (thumbContainer) {
      thumbContainer.innerHTML = '';
    }
    if (filenameElement) {
      filenameElement.textContent = '';
    }
    if (filesizeElement) {
      filesizeElement.textContent = '';
    }
    if (fileInput) {
      fileInput.value = '';
    }
    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }
  }

  /**
   * Restore uploads from FormState - re-render previews.
   * Called when navigating back to Step 4.
   */
  function restoreUploads() {
    if (typeof FormState === 'undefined' || !FormState.getStepData) {
      return;
    }

    var step3Data = FormState.getStepData(3);
    var i;

    for (i = 0; i < TARGETS.length; i++) {
      var target = TARGETS[i];
      var dataUrl = step3Data['documento-' + target];
      var filename = step3Data['documento-' + target + '-filename'];
      var size = step3Data['documento-' + target + '-size'];
      var type = step3Data['documento-' + target + '-type'];
      var uploadZone = document.querySelector('.upload-zone[data-upload-target="' + target + '"]');

      if (dataUrl && filename && size && type) {
        // File exists in state - show preview
        showPreview(target, dataUrl, filename, size, type);
      } else {
        // No file - ensure upload zone is in empty state
        if (uploadZone) {
          uploadZone.classList.remove('has-file');
        }
      }
    }
  }

  /**
   * Attach event listeners for drag-and-drop and click-to-upload.
   */
  function attachEventListeners() {
    var i;

    for (i = 0; i < TARGETS.length; i++) {
      var target = TARGETS[i];
      var dropzone = document.getElementById('dropzone-' + target);
      var fileInput = document.getElementById('file-' + target);
      var removeBtn = document.getElementById('remove-' + target);

      if (!dropzone || !fileInput || !removeBtn) {
        continue;
      }

      // File input change event
      (function (currentTarget) {
        fileInput.addEventListener('change', function (e) {
          if (e.target.files.length > 0) {
            handleFile(e.target.files[0], currentTarget);
          }
        });
      })(target);

      // Drag-and-drop events on dropzone
      (function (currentTarget, currentDropzone) {
        currentDropzone.addEventListener('dragenter', function (e) {
          e.preventDefault();
          e.stopPropagation();
        });

        currentDropzone.addEventListener('dragover', function (e) {
          e.preventDefault();
          e.stopPropagation();
          currentDropzone.classList.add('drag-over');
        });

        currentDropzone.addEventListener('dragleave', function (e) {
          e.preventDefault();
          e.stopPropagation();
          currentDropzone.classList.remove('drag-over');
        });

        currentDropzone.addEventListener('drop', function (e) {
          e.preventDefault();
          e.stopPropagation();
          currentDropzone.classList.remove('drag-over');

          if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0], currentTarget);
          }
        });
      })(target, dropzone);

      // Remove button click
      (function (currentTarget) {
        removeBtn.addEventListener('click', function () {
          removeFile(currentTarget);
        });
      })(target);
    }
  }

  /**
   * Initialize document upload module.
   * Called from app.js on DOMContentLoaded.
   */
  function init() {
    attachEventListeners();
    restoreUploads();
  }

  // Expose public API
  window.StepDocumenti = {
    init: init,
    restoreUploads: restoreUploads
  };

}());

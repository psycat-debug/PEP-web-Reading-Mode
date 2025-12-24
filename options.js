// options.js

document.addEventListener("DOMContentLoaded", () => {
  const statusElement = document.getElementById("status");

  const displayReferences = document.getElementById("displayReferences");
  const displayFootnotes = document.getElementById("displayFootnotes");
  const disableBodyLinks = document.getElementById("disableBodyLinks");
  const theme = document.getElementById("theme");
  const exportYaml = document.getElementById("exportYaml");

  const DEFAULTS = {
    displayReferences: true,
    displayFootnotes: true,
    disableBodyLinks: true,
    theme: "theme1",
    exportYaml: false,
  };

  function flashSaved() {
    statusElement.style.display = "block";
    setTimeout(() => {
      statusElement.style.display = "none";
    }, 2000);
  }

  function loadSettings() {
    chrome.storage.sync.get(
      ["displayReferences", "displayFootnotes", "disableBodyLinks", "theme", "hideReferences"],
      (data) => {
        // Back-compat: old option was `hideReferences` (true means hide)
        let derivedDisplayReferences = data.displayReferences;
        if (typeof derivedDisplayReferences === "undefined" && typeof data.hideReferences !== "undefined") {
          derivedDisplayReferences = !data.hideReferences;
        }

        displayReferences.checked =
          typeof derivedDisplayReferences === "boolean"
            ? derivedDisplayReferences
            : DEFAULTS.displayReferences;

        displayFootnotes.checked =
          typeof data.displayFootnotes === "boolean"
            ? data.displayFootnotes
            : DEFAULTS.displayFootnotes;

        disableBodyLinks.checked =
          typeof data.disableBodyLinks === "boolean"
            ? data.disableBodyLinks
            : DEFAULTS.disableBodyLinks;

        theme.value = (data.theme && String(data.theme).trim()) || DEFAULTS.theme;

        exportYaml.checked =
          typeof data.exportYaml === "boolean"
            ? data.exportYaml
            : DEFAULTS.exportYaml;
      }
    );
  }

  function saveSettings() {
    chrome.storage.sync.set(
      {
        displayReferences: displayReferences.checked,
        displayFootnotes: displayFootnotes.checked,
        disableBodyLinks: disableBodyLinks.checked,
        theme: theme.value,
        exportYaml: exportYaml.checked,
      },
      flashSaved
    );
  }

  displayReferences.addEventListener("change", saveSettings);
  displayFootnotes.addEventListener("change", saveSettings);
  disableBodyLinks.addEventListener("change", saveSettings);
  theme.addEventListener("change", saveSettings);
  exportYaml.addEventListener("change", saveSettings);

  loadSettings();
});
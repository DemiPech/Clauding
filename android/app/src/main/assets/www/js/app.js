// Point d'entrée de l'app : retour Android, événements et démarrage.
// L'interface est découpée en modules dans ./ui/.
import { getApiKey } from './cardnexus.js';
import { els, state } from './ui/core.js';
import {
  cardnexusReady, loadCardnexusDeck, loadDeckLocations, loadFabraryDeck, restoreDecks, returnToTab,
  showHome, showOnly, showSearch, showTab, showTools, updateBuildButton,
} from './ui/nav.js';
import { closeActions, openActions, renderSectionsAndMarks } from './ui/deck-view.js';
import {
  allDeckCards, applyBasket, basket, closeLinePicker, hideToast, loadLocations, movePanel,
  openLinePicker, refreshBasketViews, refreshOpenSteppers, renderBasket, restoreLocations,
  runInventorySearch, setMovePanel, showToast, takeExcess, toggleCard, toggleSelectAll, undoLastMove,
} from './ui/moves.js';
import {
  applyBuild, build, computePlan, openBuild, pickupAsText, resetAllocation, syncBuildMode,
} from './ui/build.js';
import {
  closeCompare, closeLightbox, closeSettings, copyText, deckAsText, hidePreview, movePreview,
  openCompare, openLightbox, openSettings, runCompare, saveApiKey, showPreview,
} from './ui/deck-tools.js';
import {
  collectionFilter, countAllPlaces, listenForPull, refreshCollection, renderPlacesList,
  runPlacesSearch,
} from './ui/places.js';
import {
  applyTidy, computeTidy, saveTidySelection, showTidy, tidy, tidyAsText,
} from './ui/tidy-view.js';
import {
  askConfirm, closeConfirm, closeDelete, closeRename, deleteHeldCards, openDelete, openRename,
  submitDelete, submitRename, untagCurrentView,
} from './ui/sheets.js';
import {
  INTERVAL_STORAGE, loadRecent, renderJournal, setHistoryTab, takeSnapshot, writeJournal,
  writeStored,
} from './ui/history.js';
import { readCollectionCache } from './ui/collection-cache.js';
import { listenForProgress } from './ui/progress-view.js';

// --- Retour Android --------------------------------------------------------

/**
 * Appelé par le bouton retour du téléphone. Referme d'abord ce qui est ouvert
 * par-dessus, puis remonte d'une vue ; renvoie false à l'accueil pour quitter.
 */
window.__appBack = () => {
  if (!els.settings.hidden) return closeSettings(), true;
  if (!els.compare.hidden) return closeCompare(), true;
  if (!els.actions.hidden) return closeActions(), true;
  if (!els.confirm.hidden) return closeConfirm(false), true;
  if (!els.rename.hidden) return closeRename(), true;
  if (!els.delete.hidden) return closeDelete(), true;
  if (!els.lightbox.hidden) return closeLightbox(), true;
  if (!els.linePicker.hidden) return closeLinePicker(), true;
  if (movePanel !== 'none') return setMovePanel('none'), true;
  if (!els.build.hidden) return leaveBuild(), true;
  if (!els.tidy.hidden) return showTools(), true;
  if (!els.deck.hidden || !els.error.hidden || !els.loading.hidden) return returnToTab(), true;
  if (els.places.hidden) return showHome(), true;
  return false;
};

// --- Événements ------------------------------------------------------------

/** Un lien (ou un identifiant) de deck FaBrary, plutôt qu'un nom de carte. */
const looksLikeFabrary = (value) =>
  /fabrary\.net\/decks\//i.test(value) || /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value.trim());

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = els.input.value.trim();
  if (!value) return;
  if (looksLikeFabrary(value)) {
    loadFabraryDeck(value);
    return;
  }
  if (value.length < 2) {
    els.placesSearchNote.textContent = 'Tapez au moins deux caractères.';
    return;
  }
  if (!cardnexusReady) {
    els.placesSearchNote.textContent = "Chercher dans la collection demande une clé d'API CardNexus (⚙).";
    return;
  }
  els.input.blur();
  runPlacesSearch(value);
});

els.search.addEventListener('click', (event) => {
  const example = event.target.closest('[data-example]');
  if (!example) return;
  els.input.value = example.dataset.example;
  loadFabraryDeck(example.dataset.example);
});

els.appBack.addEventListener('click', () => window.__appBack());

els.tabbar.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) showTab(tab.dataset.tab);
});

els.collectionFilter.addEventListener('input', () => {
  collectionFilter.text = els.collectionFilter.value;
  renderPlacesList();
});
els.collectionKinds.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-kind]');
  if (!chip) return;
  collectionFilter.kind = chip.dataset.kind;
  for (const other of els.collectionKinds.querySelectorAll('[data-kind]')) {
    other.classList.toggle('is-active', other === chip);
  }
  renderPlacesList();
});

els.toolBuild.addEventListener('click', () => {
  showSearch();
  els.placesSearchNote.textContent =
    'Collez le lien du deck FaBrary à monter, puis touchez « Monter dans CardNexus » sur la liste.';
  els.input.focus();
});
els.toolCompare.addEventListener('click', () => openCompare({ pick: true }));
els.historyTabs.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-history-tab]');
  if (chip) setHistoryTab(chip.dataset.historyTab);
});
els.recentMore.addEventListener('click', () => loadRecent());
els.snapshotNow.addEventListener('click', async () => {
  const result = await takeSnapshot();
  if (!result) return;
  showToast(
    result.first
      ? 'Première photo prise : les suivantes lui seront comparées.'
      : result.changes.length
        ? `${result.changes.length} changement${result.changes.length > 1 ? 's' : ''} depuis la photo précédente.`
        : 'Aucun changement depuis la photo précédente.',
  );
});
els.settingsSnapshot.addEventListener('change', () => {
  writeStored(INTERVAL_STORAGE, Number(els.settingsSnapshot.value));
});
els.journalClear.addEventListener('click', async () => {
  const confirmed = await askConfirm({
    title: 'Vider le journal',
    text: "Effacer tout le journal des actions de l'app ? Les cartes ne bougent pas, seul l'historique est effacé.",
    ok: 'Vider le journal',
    danger: true,
  });
  if (!confirmed) return;
  writeJournal([]);
  renderJournal();
});
els.openTidy.addEventListener('click', showTidy);
els.placesCount.addEventListener('click', countAllPlaces);
els.placesRefresh.addEventListener('click', refreshCollection);
listenForPull();
els.placesList.addEventListener('click', (event) => {
  const place = event.target.closest('[data-place]');
  if (!place) return;
  state.from = 'collection';
  loadCardnexusDeck(place.dataset.place);
});

els.tidyBack.addEventListener('click', showTools);
els.tidySetup.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-tidy-mode]');
  if (!chip) return;
  tidy.mode = chip.dataset.tidyMode;
  for (const other of els.tidySetup.querySelectorAll('[data-tidy-mode]')) {
    other.classList.toggle('is-active', other === chip);
  }
  if (tidy.plan) computeTidy();
});
els.tidySetup.addEventListener('change', saveTidySelection);
els.tidySetup.addEventListener('submit', (event) => {
  event.preventDefault();
  computeTidy();
});
els.tidyApply.addEventListener('click', applyTidy);
els.tidyCopy.addEventListener('click', async () => {
  try {
    await copyText(tidyAsText());
    els.tidyCopy.textContent = 'Copié !';
  } catch {
    els.tidyCopy.textContent = 'Copie refusée';
  }
  setTimeout(() => {
    els.tidyCopy.textContent = 'Copier le plan';
  }, 1600);
});

els.toolbar.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;

  const value = chip.dataset.view;
  if (!value || state.view === value) return;

  state.view = value;
  for (const sibling of chip.parentElement.querySelectorAll('.chip')) {
    sibling.classList.toggle('is-active', sibling === chip);
  }
  renderSectionsAndMarks();
});

els.excessBtn.addEventListener('click', () => takeExcess(Number(els.excessKeep.value) || 3));

els.groupSelect.addEventListener('change', () => {
  state.group = els.groupSelect.value;
  renderSectionsAndMarks();
});

els.copyBtn.addEventListener('click', async () => {
  if (!state.deck) return;
  try {
    await copyText(deckAsText(state.deck));
    showToast('Decklist copiée dans le presse-papiers.');
  } catch {
    showToast('Copie refusée par le téléphone.', { error: true });
  }
});

els.moreBtn.addEventListener('click', openActions);
els.actionsClose.addEventListener('click', closeActions);
els.actions.addEventListener('click', (event) => {
  if (event.target === els.actions) closeActions();
});
// Une action choisie referme le menu (son propre gestionnaire a déjà agi).
els.actionList.addEventListener('click', (event) => {
  if (event.target.closest('.action-item')) closeActions();
});
els.clearBasket.addEventListener('click', () => {
  basket.clear();
  refreshBasketViews();
  refreshOpenSteppers();
  setMovePanel('none');
});

els.sections.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const target = event.target.closest('[data-image]');
  if (target) showPreview(target, event);
});

els.sections.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;
  if (event.target.closest('[data-image]')) movePreview(event);
});

els.sections.addEventListener('pointerout', (event) => {
  const to = event.relatedTarget;
  if (!to || !to.closest?.('[data-image]')) hidePreview();
});

els.sections.addEventListener('click', (event) => {
  // Le « + » garde son rôle : choisir exemplaire par exemplaire.
  const pickup = event.target.closest('.pickup-btn');
  if (pickup) {
    const card = findCard(pickup.dataset.pickup);
    if (card) openLinePicker(card, pickup);
    return;
  }

  // Sur un deck d'inventaire, toucher une carte prend tous ses exemplaires.
  const slot = event.target.closest('.card-slot.is-selectable');
  if (slot) {
    const card = findCard(slot.dataset.card);
    if (card) toggleCard(card);
    return;
  }

  const target = event.target.closest('[data-image]');
  if (target?.dataset.image) openLightbox(target.dataset.image);
});

// Appui long : voir la carte en grand, même quand le toucher sert à la prendre.
els.sections.addEventListener('contextmenu', (event) => {
  const target = event.target.closest('[data-image]');
  if (!target?.dataset.image) return;
  event.preventDefault();
  openLightbox(target.dataset.image);
});

els.lightbox.addEventListener('click', closeLightbox);

/** Retrouve une carte du deck affiché par son identifiant. */
function findCard(id) {
  return allDeckCards().find((c) => c.id === id) || null;
}

els.linePickerClose.addEventListener('click', closeLinePicker);

document.addEventListener('click', (event) => {
  if (els.linePicker.hidden) return;
  if (event.target.closest('#line-picker') || event.target.closest('.pickup-btn')) return;
  closeLinePicker();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeLinePicker();
  closeLightbox();
  closeSettings();
  closeCompare();
  closeRename();
  closeDelete();
  if (!els.confirm.hidden) closeConfirm(false);
  closeActions();
});

els.deleteCards.addEventListener('click', deleteHeldCards);
els.untagBtn.addEventListener('click', untagCurrentView);
els.confirmForm.addEventListener('submit', (event) => {
  event.preventDefault();
  closeConfirm(true);
});
els.confirmCancel.addEventListener('click', () => closeConfirm(false));
els.confirmClose.addEventListener('click', () => closeConfirm(false));
els.confirm.addEventListener('click', (event) => {
  if (event.target === els.confirm) closeConfirm(false);
});

els.renameBtn.addEventListener('click', openRename);
els.renameClose.addEventListener('click', closeRename);
els.renameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitRename();
});
els.deleteBtn.addEventListener('click', openDelete);
els.deleteClose.addEventListener('click', closeDelete);
els.deleteCancel.addEventListener('click', closeDelete);
els.deleteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitDelete();
});
for (const sheet of [els.rename, els.delete]) {
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) sheet.hidden = true;
  });
}

els.heroArt.addEventListener('click', () => {
  const hero = state.deck?.hero;
  if (hero?.printings?.length) toggleCard(hero);
  else openLightbox(hero?.imageUrl);
});

els.heroArt.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  openLightbox(state.deck?.hero?.imageUrl);
});

els.destination.addEventListener('change', renderBasket);
els.selectAll.addEventListener('click', toggleSelectAll);
els.searchToggle.addEventListener('click', () => setMovePanel('search'));
els.basketToggle.addEventListener('click', () => setMovePanel('basket'));

els.moveSearchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const term = els.moveSearchInput.value.trim();
  if (term.length < 2) {
    els.moveSearchNote.textContent = 'Tapez au moins deux caractères.';
    return;
  }
  els.moveSearchInput.blur();
  runInventorySearch(term);
});

els.applyMove.addEventListener('click', applyBasket);
els.toastUndo.addEventListener('click', undoLastMove);
els.toastClose.addEventListener('click', hideToast);

els.buildBtn.addEventListener('click', () => {
  if (state.deck) openBuild(state.deck);
});

/** Quitte le plan de montage vers là d'où il a été ouvert. */
function leaveBuild() {
  if (build.returnTo === 'tools' || !state.deck) showTools();
  else showOnly(els.deck);
}

els.buildBack.addEventListener('click', leaveBuild);
els.buildSetup.addEventListener('change', syncBuildMode);
els.buildSetup.addEventListener('submit', (event) => {
  event.preventDefault();
  computePlan();
});
els.buildApply.addEventListener('click', applyBuild);
els.buildReset.addEventListener('click', resetAllocation);
// Changer la protection des decks change la répartition : on recalcule.
els.buildProtect.addEventListener('change', () => {
  if (build.plan) computePlan();
});
els.buildDeckHintBtn.addEventListener('click', () => {
  els.buildProtect.checked = false;
  computePlan();
});
els.buildPickupCopy.addEventListener('click', async () => {
  try {
    await copyText(pickupAsText());
    els.buildPickupCopy.textContent = 'Copié !';
  } catch {
    els.buildPickupCopy.textContent = 'Copie refusée';
  }
  setTimeout(() => {
    els.buildPickupCopy.textContent = 'Copier le récap';
  }, 1600);
});
els.buildHideSettled.addEventListener('change', () => {
  els.buildRows.classList.toggle('hide-settled', els.buildHideSettled.checked);
});

els.compareBtn.addEventListener('click', openCompare);
els.compareClose.addEventListener('click', closeCompare);
els.compare.addEventListener('click', (event) => {
  if (event.target === els.compare) closeCompare();
});
els.compareForm.addEventListener('submit', (event) => {
  event.preventDefault();
  els.compareInput.blur();
  runCompare();
});

els.settingsBtn.addEventListener('click', openSettings);
els.settingsClose.addEventListener('click', closeSettings);
els.settings.addEventListener('click', (event) => {
  if (event.target === els.settings) closeSettings();
});
els.settingsShow.addEventListener('change', () => {
  els.settingsKey.type = els.settingsShow.checked ? 'text' : 'password';
});
els.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveApiKey(els.settingsKey.value);
});
els.settingsClear.addEventListener('click', () => saveApiKey(''));

window.addEventListener('scroll', hidePreview, { passive: true });

// --- Démarrage -------------------------------------------------------------

const params = new URLSearchParams(location.search);
const initialDeck = params.get('deck');
const initialLocation = params.get('location');

state.tab = 'collection';
listenForProgress();

// Démarrage instantané : la liste de la dernière fois s'affiche tout de suite,
// puis se met à jour en arrière-plan (la barre du haut montre l'avancement).
const cache = readCollectionCache();
if (cache) {
  restoreLocations(cache.locations);
  if (cache.decks) restoreDecks(cache.decks, cache.deckInfo);
}
loadDeckLocations({ background: Boolean(cache) }).then(() => {
  updateBuildButton();
  if (!els.places.hidden) renderPlacesList();
});
loadLocations({ background: Boolean(cache) }).then(() => {
  if (!els.places.hidden) renderPlacesList();
});
renderBasket();

if (initialDeck) {
  els.input.value = initialDeck;
  state.tab = 'search';
  loadFabraryDeck(initialDeck);
} else if (initialLocation) {
  state.from = 'collection';
  loadCardnexusDeck(initialLocation);
} else {
  showHome();
  // Premier lancement : la clé est le seul réglage, on le propose d'emblée.
  if (!getApiKey()) openSettings();
}

# Jeu — squelette Android

Un point de départ pour faire un jeu Android, indépendant de FaB Decks (dossier, workflow,
identifiant d'app et release à part : les deux apps s'installent côte à côte).

Même principe technique : une WebView plein écran qui affiche un jeu en HTML/JavaScript
(canvas 2D, modules ES, aucune dépendance). Le squelette tourne déjà avec une petite démo,
**Attrape-étoiles** : on déplace la barre au doigt (ou aux flèches) pour attraper les étoiles
jaunes et éviter les bombes rouges.

## Installer sur le téléphone

1. Ouvrir la release `game-apk-latest` du dépôt
   (`https://github.com/<propriétaire>/<dépôt>/releases/tag/game-apk-latest`).
2. Télécharger `jeu.apk` et l'ouvrir (autoriser les « sources inconnues » la première fois).

Chaque push qui touche `game/` lance les tests puis recompile l'APK (workflow `APK Jeu`).
Toutes les versions sont signées avec `app/game.keystore` : une mise à jour s'installe
par-dessus l'ancienne sans perdre la sauvegarde.

## Organisation

```
app/src/main/assets/www/
  index.html, styles.css      un canvas plein écran
  js/main.js                  assemble le moteur et lance la première scène
  js/engine/                  le moteur, réutilisable tel quel
    loop.js                   boucle à pas fixe (même physique à 60 ou 120 Hz)
    scenes.js                 pile de scènes (titre, partie, pause par-dessus...)
    input.js                  toucher / souris et clavier
    view.js                   résolution virtuelle mise à l'échelle de l'écran
    storage.js                sauvegarde (localStorage)
    audio.js                  sons générés (WebAudio)
    math.js                   collisions, hasard à graine, clamp...
  js/game/                    le jeu lui-même : c'est ici qu'on travaille
    config.js                 résolution, couleurs, règles
    world.js                  logique pure de la démo (testable sans écran)
    ui.js                     texte, boutons
    scenes/                   title, play, pause, gameover
app/src/main/java/.../MainActivity.java   plein écran, écran allumé, retour, pause
tests/                        unitaires (node:test) et parcours dans Chromium (Playwright)
```

### Une scène

Un objet aux méthodes toutes facultatives : `update(dt)`, `render(ctx)`, `enter()`, `exit()`,
`pause()`, `resume()`, `back()` (bouton retour : `true` si géré, `false` pour quitter l'app),
`suspend()` (l'app passe en arrière-plan). `overlay: true` laisse voir la scène du dessous.
Tout ce dont une scène a besoin passe par l'objet `game` : `game.scenes`, `game.input`,
`game.audio`, `game.save`, `game.rng`.

```js
export function maScene(game) {
  return {
    name: 'ma-scene',
    update(dt) {
      if (game.input.tapped()) game.scenes.pop();
    },
    render(ctx) {
      ctx.fillStyle = 'white';
      ctx.fillRect(10, 10, 50, 50);
    },
  };
}
// ailleurs : game.scenes.push(maScene(game));
```

Les coordonnées sont toujours celles du jeu (360 × 640 par défaut, `config.js`), quelle que
soit la taille de l'écran.

### Partir de là

- Remplacer `world.js` et `scenes/play.js` par votre jeu ; garder le moteur.
- Nom de l'app : `app/src/main/res/values/strings.xml`. Icône : `res/drawable/ic_launcher_foreground.xml`.
- Paysage : `android:screenOrientation="sensorLandscape"` dans le manifeste, et inverser
  `WIDTH`/`HEIGHT` dans `config.js`.
- Images et sons : les mettre dans `assets/www/` (le type des `png`, `webp`, `ogg`, `mp3`...
  est déjà servi par `MainActivity`).

## Tester

```
cd game/tests
npm ci
npx playwright install chromium
npm test
```

Pour essayer le jeu sur PC sans téléphone, servir `app/src/main/assets/www/` avec n'importe quel
serveur local (`npx serve app/src/main/assets/www`) et l'ouvrir dans le navigateur : il se joue
à la souris ou aux flèches.

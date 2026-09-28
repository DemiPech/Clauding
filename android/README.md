# FaB Decks — version Android

Le Decklist Viewer (FaBrary + CardNexus) en application Android à installer par APK.
Mêmes écrans et mêmes fonctions que la version PC : decks FaBrary, decks d'inventaire
CardNexus, déplacement de cartes, montage d'une liste FaBrary dans CardNexus.

## Installer sur le téléphone

1. Ouvrir la page **Releases** du dépôt, release `apk-latest`
   (`https://github.com/<propriétaire>/<dépôt>/releases/tag/apk-latest`).
2. Télécharger `fab-decks.apk`, puis l'ouvrir. Android demande d'autoriser l'installation
   depuis le navigateur (« sources inconnues ») la première fois.
3. Au premier lancement, coller sa clé d'API CardNexus dans les réglages (⚙). Elle reste
   sur le téléphone ; les decks FaBrary fonctionnent sans.

Chaque push qui touche `android/` recompile l'APK (workflow `APK Android`) et remplace le
fichier de la release. Toutes les versions sont signées avec la même clé
(`app/decklist.keystore`), donc une mise à jour s'installe par-dessus l'ancienne sans
perdre la clé d'API.

## Comment c'est fait

Pas de serveur Node sur le téléphone : l'app est une WebView qui embarque l'interface web.

```
app/src/main/java/.../MainActivity.java   WebView + pont natif (HTTP, presse-papiers, liens)
app/src/main/assets/www/
  index.html, styles.css                  interface, adaptée au mobile
  js/app.js                               l'app.js du PC, avec quelques ajouts mobiles
  js/api.js                               remplace server.js : répond aux fetch('/api/…')
  js/fabrary.js, js/cardnexus.js          les clients de lib/, portés au navigateur
  js/http.js                              requêtes sortantes via le pont natif
```

- `api.js` intercepte les appels `fetch('/api/…')` et y répond localement, avec les mêmes
  routes, handlers et cache que `server.js` : `app.js` reste presque identique au PC.
- Les appels vers CardNexus et FaBrary passent par Java (`AndroidApp.request`). Ils échappent
  ainsi au CORS du navigateur, et peuvent porter les en-têtes `Origin` / `Referer` /
  `User-Agent` exigés par le WAF de FaBrary.
- La signature SigV4 de FaBrary utilise WebCrypto au lieu de `node:crypto`. Elle produit
  exactement les mêmes signatures que la version PC.
- L'interface est servie sous `https://appassets.androidplatform.net/` (interceptée,
  jamais réseau) : c'est un contexte sécurisé, nécessaire pour WebCrypto et les modules ES.

Ajouts propres au mobile :

- **Réglages (⚙)** : saisie de la clé CardNexus, à la place de `api_key.txt`.
- **Carte en grand** : toucher une carte (deck FaBrary) ou appui long (deck d'inventaire,
  où le toucher sert à prendre la carte) l'affiche en plein écran.
- **Bouton retour** : ferme ce qui est ouvert, remonte d'une vue, et quitte depuis l'accueil.
- **Liens externes** (« Voir sur FaBrary ») : ouverts dans le navigateur du téléphone.

## Compiler soi-même

JDK 17, SDK Android (plateforme 34) et Gradle 8.7+ :

```bash
cd android
gradle assembleRelease   # → app/build/outputs/apk/release/app-release.apk
```

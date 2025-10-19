# NOISE.IO MVP

MVP jouable: lobbys, chat, enregistrement 30s, validation des réponses, scoring, fin de partie, replays.

## Démarrage

1. Installer les dépendances
```
npm install
```
2. Lancer le serveur
```
npm start
```
3. Ouvrir http://localhost:3000 dans 2 onglets (ou 2 navigateurs) pour tester.

## Notes
- Données en mémoire (pas de base de données) pour ce MVP.
- Les audios sont envoyés en base64 via WebSocket après l'arrêt de l'enregistrement.
- La validation des réponses ignore casse, accents et ponctuation.
- Le score +1 pour le recorder et +1 pour le joueur qui trouve.
- L'hôte peut terminer la partie et visualiser le leaderboard et les replays.

# Pont Chaban-Delmas

Fermetures à la circulation du pont levant Chaban-Delmas, à Bordeaux, d'après l'open data de
Bordeaux Métropole : le pont est-il fermé, les prochaines fermetures, et des alertes de scène la
veille, à la fermeture et à la réouverture. Sans lien avec Bordeaux Métropole.

## Ce que vous obtenez

- Un appareil **Pont Chaban-Delmas**, à ajouter depuis l'onglet **Découverte**.
- Trois déclencheurs et une action de scène (Gladys 5.3 ou plus récent).
- Un widget de tableau de bord **Fermetures du pont**.

## Installation

Rien à régler : le jeu de données est public, gratuit et sans compte. L'intégration le lit dès son
démarrage.

## Configuration

**Langue des textes** : langue des noms d'appareil et de fonctionnalités, des valeurs textuelles et
des phrases de scène (français par défaut). Les noms sont fixés à la création : pour les renommer,
supprimez puis rajoutez l'appareil.

Le bouton **Vérifier** relit le planning tout de suite et affiche le nombre de fermetures à venir,
la prochaine et la date de mise à jour du planning.

## L'appareil

| Fonctionnalité               | Valeur                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| Fermé à la circulation       | 1 pendant une fermeture, 0 sinon                               |
| Fermeture prévue aujourd'hui | 1 si une fermeture est en cours ou commence plus tard ce jour  |
| Prochaine fermeture          | Jour et heure de la prochaine fermeture (ou de celle en cours) |
| Réouverture                  | Jour et heure de la réouverture                                |
| Motif de la fermeture        | Nom du navire, MAINTENANCE ou événement, tel que publié        |
| Type de fermeture            | Totale ou partielle                                            |
| Minutes avant la fermeture   | 0 pendant la fermeture                                         |
| Fermetures sous 7 jours      | Fermetures pas encore finies qui commencent sous 7 jours       |
| Planning mis à jour          | Dernière mise à jour du jeu par Bordeaux Métropole             |

L'appareil suit l'horloge : il passe à fermé puis à ouvert aux heures prévues, même quand le
portail open data est injoignable (le dernier planning lu est gardé dans `/data`).

## Scènes

### Déclencheurs

- **Fermeture demain** : la veille d'une fermeture, à l'heure choisie (8 h, 12 h, 17 h à 22 h),
  avec toutes les fermetures du lendemain. Variables : phrase prête à envoyer, nombre de
  fermetures, jour, heures de la première fermeture et de sa réouverture, premier navire ou
  événement, fermeture totale.
- **Début de fermeture** : à l'heure prévue de fermeture.
- **Fin de fermeture** : à l'heure prévue de réouverture.

Ces deux-là donnent la phrase, le navire ou l'événement, le motif (`boat`, `maintenance`,
`event`), les heures, la durée et si la fermeture est totale. Utilisez
`{{triggerEvent.data.sentence}}` dans un message. Chaque événement part une seule fois, même après
un redémarrage ; un événement manqué pendant un arrêt de plus de 10 minutes n'est pas envoyé en
retard.

### Action

**Lire la prochaine levée** : une phrase comme « Prochaine fermeture du pont Chaban-Delmas :
dimanche 8 novembre, de 07:00 à 15:00 (MARATHON DE BORDEAUX), fermeture totale. », ou « fermé
jusqu'à… » pendant une fermeture. Sorties : phrase, fermé maintenant, minutes avant la fermeture
(0 en cours, -1 aucune), début, fin, navire ou événement, totale.

## Tableau de bord

Le widget **Fermetures du pont** indique si la circulation est ouverte ou fermée, le compte à
rebours de la prochaine fermeture (ou l'heure de réouverture), et les 3, 5 ou 8 prochaines
fermetures avec leur type. Un réglage masque l'état et le compte à rebours. Il prend le nom donné à
l'appareil dans Gladys.

## Données, limites et quotas

- Source : jeu
  [Pont Chaban - Prévisions - Fermeture](https://opendata.bordeaux-metropole.fr/explore/dataset/previsions_pont_chaban/)
  de Bordeaux Métropole, Licence Ouverte (Etalab). Lu toutes les heures (toutes les 10 minutes après
  un échec), deux requêtes à chaque fois, très loin des 50 000 appels par jour permis par le portail.
- Ce sont des **prévisions** : un navire peut être en retard ou annulé, et le jeu est mis à jour à la
  main, quelques fois par mois. Les horaires peuvent changer au dernier moment : vérifiez sur place.
- Les heures sont celles de Bordeaux (Europe/Paris, changements d'heure compris), affichées dans le
  fuseau de Gladys. Une réouverture plus tôt que la fermeture est lue comme le lendemain
  (maintenance de nuit).
- Le motif (navire, maintenance, événement) est déduit du libellé publié.
- Aucun autre pont levant français ne publie ses fermetures en open data pour l'instant : cette
  intégration ne couvre que Chaban-Delmas.

## Dépannage

- **L'appareil reste vide** : le planning n'a pas encore été lu ; l'état de connexion de
  l'intégration dit pourquoi. Appuyez sur **Vérifier**.
- **« Injoignable »** : le portail open data est en panne ou votre Gladys n'a pas accès à Internet.
  Le dernier planning lu reste utilisé.
- Plus de détails dans les journaux de l'intégration, avec `LOG_LEVEL=debug`.

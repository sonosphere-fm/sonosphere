import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Ou colle ceci dans ton navigateur :",
  manageEmails: "Choisis les e-mails que tu reçois",
  manageEmailsLine: "Choisis les e-mails que tu reçois : {url}",
  footer: "Tu reçois ce message parce que tu as un compte sur {site}.",
  quoted: "« {text} »",

  verifySubject: "Confirme ton adresse e-mail pour Sonosphere",
  verifyHeading: "Salut {username}, confirme ton adresse e-mail",
  verifyBody:
    "Merci d’avoir rejoint Sonosphere. Confirme que c’est bien ton adresse e-mail pour pouvoir récupérer ton compte si tu oublies un jour ton mot de passe.",
  verifyButton: "Confirmer l’adresse",
  verifyNote:
    "Le lien est valable 3 jours ; tu peux en demander un nouveau depuis les Paramètres. Les comptes non confirmés sous {days} jours sont supprimés. Si tu ne t’es pas inscrit, ignore ce message et le compte sera supprimé.",

  welcomeSubject: "Bienvenue sur Sonosphere",
  welcomeHeading: "Bienvenue, {username}",
  welcomeIntro: "Ton adresse e-mail est confirmée et ton compte est prêt. Quelques idées pour commencer :",
  welcomeImport:
    "Emporte tes scrobbles avec toi. Importe ton historique d’écoute depuis Last.fm ou un fichier, et ton profil, tes classements et tes recommandations se remplissent à partir de tout ce que tu as écouté.",
  welcomeImportButton: "Importer tes scrobbles",
  welcomeConnect:
    "Connecte ensuite un lecteur pour que chaque morceau que tu écoutes soit scrobblé sur ton profil. Spotify, les lecteurs de bureau et les applis mobiles fonctionnent tous.",
  welcomeConnectButton: "Connecter un lecteur",
  welcomeFollow:
    "Suis tes amis et trouve tes âmes sœurs musicales : les personnes dont les goûts ressemblent le plus aux tiens.",
  welcomeProfile: "Ton profil : {url}",

  resetSubject: "Réinitialise ton mot de passe Sonosphere",
  resetHeading: "Réinitialise ton mot de passe",
  resetBody: "Quelqu’un (toi, on l’espère) a demandé à réinitialiser le mot de passe de {username} sur Sonosphere.",
  resetButton: "Choisir un nouveau mot de passe",
  resetNote:
    "Le lien est valable une heure et une seule fois. Si tu n’as rien demandé, ignore ce message : ton mot de passe reste inchangé.",

  changeSubject: "Confirme ta nouvelle adresse e-mail pour Sonosphere",
  changeHeading: "Confirme ta nouvelle adresse e-mail",
  changeBody:
    "{username} sur Sonosphere a demandé à utiliser cette adresse désormais. Confirme-la pour appliquer le changement.",
  changeButton: "Confirmer la nouvelle adresse",
  changeNote:
    "Le lien est valable 3 jours. Tant qu’il n’est pas utilisé, le compte garde son ancienne adresse. Si ce n’était pas toi, ignore ce message.",

  approveSubject: "Approuve le changement d’adresse e-mail Sonosphere",
  approveHeading: "Approuver le changement d’adresse",
  approveBody:
    "{username} a demandé à changer son adresse e-mail pour {email}. Approuve d’abord ici ; on enverra ensuite un lien de vérification à la nouvelle adresse.",
  approveButton: "Approuver le changement",
  approveNote:
    "Ce lien est valable une heure. Si tu n’as pas demandé ce changement, ne l’approuve pas et change ton mot de passe.",

  emailChangedSubject: "Ton adresse e-mail Sonosphere a été modifiée",
  emailChangedHeading: "Ton adresse e-mail a été modifiée",
  emailChangedBody:
    "L’adresse e-mail de {username} sur Sonosphere est désormais {email}. Les messages concernant le compte y seront envoyés à partir de maintenant.",
  emailChangedWarning:
    "Si tu n’as pas fait ce changement, quelqu’un d’autre a peut-être ton mot de passe. Réinitialise-le depuis la page de connexion et préviens l’équipe du site.",

  passwordChangedSubject: "Ton mot de passe Sonosphere a été modifié",
  passwordChangedHeading: "Ton mot de passe a été modifié",
  passwordChangedBody:
    "Le mot de passe de {username} sur Sonosphere vient d’être modifié, et tous les autres appareils ont été déconnectés.",
  passwordSetSubject: "Tu as défini un mot de passe sur Sonosphere",
  passwordSetHeading: "Tu as défini un mot de passe",
  passwordSetBody:
    "{username} sur Sonosphere a maintenant un mot de passe. Tu peux t’en servir pour te connecter, et dans les applis de scrobbling qui en demandent un. La connexion via tes autres sites fonctionne toujours.",
  notYouReset: "Si ce n’était pas toi, réinitialise ton mot de passe tout de suite depuis la page de connexion.",
  resetPasswordButton: "Réinitialiser le mot de passe",

  digestSubjectDaily: "Ta journée sur Sonosphere : {count} nouveautés",
  digestSubjectWeekly: "Ta semaine sur Sonosphere : {count} nouveautés",
  digestHeading: "Salut {username}, voici ce que tu as manqué",
  digestMore: "Et {count} de plus dans ta boîte de réception.",
  digestMessages: { one: "{count} nouveau message de {people}", other: "{count} nouveaux messages de {people}" },
  digestPeople: { one: "{count} personne", other: "{count} personnes" },
  openInbox: "Ouvrir ta boîte de réception",

  followed: "{who} a commencé à te suivre",
  followedBySomeone: "Quelqu’un a commencé à te suivre",
  seeProfile: "Voir son profil",
  wallReply: "{who} a répondu à ton message sur le mur",
  wallReplyBySomeone: "Quelqu’un a répondu à ton message sur le mur",
  wallPost: "{who} a écrit sur ton mur",
  wallPostBySomeone: "Quelqu’un a écrit sur ton mur",
  seeWall: "Voir le mur",
  commented: "{who} a commenté « {title} »",
  commentedBySomeone: "Quelqu’un a commenté « {title} »",
  commentedOnJournal: "{who} a commenté « ton article de journal »",
  commentedOnJournalBySomeone: "Quelqu’un a commenté « ton article de journal »",
  seeComment: "Voir le commentaire",
  messageRequest: "{from} t’a envoyé une demande de message",
  seeRequest: "Voir la demande",
  messageSent: "{from} t’a envoyé un message",
  readIt: "Le lire",
} satisfies Translation<typeof en>;

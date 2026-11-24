import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "O pega esto en tu navegador:",
  manageEmails: "Elige qué correos recibes",
  manageEmailsLine: "Elige qué correos recibes: {url}",
  footer: "Recibes esto porque tienes una cuenta en {site}.",
  quoted: "«{text}»",

  verifySubject: "Confirma tu correo para Sonosphere",
  verifyHeading: "Hola, {username}: confirma tu correo",
  verifyBody:
    "Gracias por unirte a Sonosphere. Confirma que esta es tu dirección de correo para poder recuperar tu cuenta si alguna vez olvidas la contraseña.",
  verifyButton: "Confirmar correo",
  verifyNote:
    "El enlace funciona durante 3 días; puedes pedir uno nuevo desde Ajustes. Las cuentas que no se confirman en {days} días se eliminan. Si no te registraste, ignora este mensaje y la cuenta se eliminará.",

  welcomeSubject: "Te damos la bienvenida a Sonosphere",
  welcomeHeading: "Bienvenido, {username}",
  welcomeIntro: "Tu correo está confirmado y tu cuenta está lista. Algunas cosas para empezar:",
  welcomeImport:
    "Trae tus scrobbles contigo. Importa tu historial de escuchas desde Last.fm o desde un archivo, y tu perfil, tus listas y tus recomendaciones se llenarán con todo lo que has escuchado.",
  welcomeImportButton: "Importar tus scrobbles",
  welcomeConnect:
    "Después conecta un reproductor para que cada canción que escuches a partir de ahora se scrobblee en tu perfil. Funcionan Spotify, los reproductores de escritorio y las apps del móvil.",
  welcomeConnectButton: "Conectar un reproductor",
  welcomeFollow:
    "Sigue a tus amigos y encuentra a tus almas gemelas musicales: las personas con el gusto más parecido al tuyo.",
  welcomeProfile: "Tu perfil: {url}",

  resetSubject: "Restablece tu contraseña de Sonosphere",
  resetHeading: "Restablece tu contraseña",
  resetBody: "Alguien (esperamos que tú) pidió restablecer la contraseña de {username} en Sonosphere.",
  resetButton: "Elegir una contraseña nueva",
  resetNote:
    "El enlace funciona durante una hora y solo una vez. Si no lo pediste, ignora este mensaje: tu contraseña seguirá igual.",

  changeSubject: "Confirma tu nuevo correo para Sonosphere",
  changeHeading: "Confirma tu nuevo correo",
  changeBody: "{username} en Sonosphere pidió usar esta dirección a partir de ahora. Confírmala para hacer el cambio.",
  changeButton: "Confirmar nuevo correo",
  changeNote:
    "El enlace funciona durante 3 días. Hasta que se use, la cuenta mantiene su dirección anterior. Si no fuiste tú, ignora este mensaje.",

  approveSubject: "Aprueba el cambio de correo de Sonosphere",
  approveHeading: "Aprobar cambio de correo",
  approveBody:
    "{username} solicitó cambiar su correo a {email}. Primero apruébalo aquí; después enviaremos un enlace de verificación a la nueva dirección.",
  approveButton: "Aprobar cambio de correo",
  approveNote:
    "Este enlace funciona durante una hora. Si no solicitaste este cambio, no lo apruebes y cambia tu contraseña.",

  emailChangedSubject: "Se cambió tu correo de Sonosphere",
  emailChangedHeading: "Se cambió tu correo",
  emailChangedBody:
    "El correo de {username} en Sonosphere ahora es {email}. Los correos sobre la cuenta llegarán ahí a partir de ahora.",
  emailChangedWarning:
    "Si no hiciste este cambio, puede que otra persona tenga tu contraseña. Restablécela desde la página de inicio de sesión y avisa al equipo del sitio.",

  passwordChangedSubject: "Se cambió tu contraseña de Sonosphere",
  passwordChangedHeading: "Se cambió tu contraseña",
  passwordChangedBody:
    "La contraseña de {username} en Sonosphere se acaba de cambiar y se cerró la sesión en todos los demás dispositivos.",
  passwordSetSubject: "Creaste una contraseña en Sonosphere",
  passwordSetHeading: "Creaste una contraseña",
  passwordSetBody:
    "{username} en Sonosphere ahora tiene contraseña. Puedes iniciar sesión con ella y usarla en apps de scrobbling que la pidan. Iniciar sesión con tus otros sitios también sigue funcionando.",
  notYouReset: "Si no fuiste tú, restablece tu contraseña ahora mismo desde la página de inicio de sesión.",
  resetPasswordButton: "Restablecer contraseña",

  digestSubjectDaily: "Tu día en Sonosphere: {count} sin leer",
  digestSubjectWeekly: "Tu semana en Sonosphere: {count} sin leer",
  digestHeading: "Hola, {username}: esto es lo que te perdiste",
  digestMore: "Y {count} más en tu bandeja de entrada.",
  digestMessages: { one: "{count} mensaje nuevo de {people}", other: "{count} mensajes nuevos de {people}" },
  digestPeople: { one: "{count} persona", other: "{count} personas" },
  openInbox: "Abrir tu bandeja de entrada",

  followed: "{who} empezó a seguirte",
  followedBySomeone: "Alguien empezó a seguirte",
  seeProfile: "Ver su perfil",
  wallReply: "{who} respondió a tu publicación en el muro",
  wallReplyBySomeone: "Alguien respondió a tu publicación en el muro",
  wallPost: "{who} escribió en tu muro",
  wallPostBySomeone: "Alguien escribió en tu muro",
  seeWall: "Ver el muro",
  commented: "{who} comentó en «{title}»",
  commentedBySomeone: "Alguien comentó en «{title}»",
  commentedOnJournal: "{who} comentó en «tu entrada del diario»",
  commentedOnJournalBySomeone: "Alguien comentó en «tu entrada del diario»",
  seeComment: "Ver el comentario",
  messageRequest: "{from} te envió una solicitud de mensaje",
  seeRequest: "Ver la solicitud",
  messageSent: "{from} te envió un mensaje",
  readIt: "Leerlo",
} satisfies Translation<typeof en>;

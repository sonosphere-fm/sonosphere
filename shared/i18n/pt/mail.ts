import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Ou cole isto no seu navegador:",
  manageEmails: "Escolha quais e-mails você recebe",
  manageEmailsLine: "Escolha quais e-mails você recebe: {url}",
  footer: "Você está recebendo isto por causa de uma conta no {site}.",
  quoted: "“{text}”",

  verifySubject: "Confirme seu e-mail no Sonosphere",
  verifyHeading: "Oi, {username}, confirme seu e-mail",
  verifyBody:
    "Obrigado por entrar no Sonosphere. Confirme que este é o seu endereço de e-mail para poder voltar à sua conta se um dia esquecer a senha.",
  verifyButton: "Confirmar e-mail",
  verifyNote:
    "O link vale por 3 dias; você pode pedir um novo em Configurações. Contas não confirmadas em {days} dias são excluídas. Se você não se cadastrou, ignore esta mensagem e a conta será removida.",

  welcomeSubject: "Boas-vindas ao Sonosphere",
  welcomeHeading: "Boas-vindas, {username}",
  welcomeIntro: "Seu e-mail está confirmado e sua conta está pronta. Algumas coisas para experimentar primeiro:",
  welcomeImport:
    "Traga seus scrobbles com você. Importe seu histórico do Last.fm ou de um arquivo, e seu perfil, paradas e recomendações se preenchem com tudo o que você já ouviu.",
  welcomeImportButton: "Importar seus scrobbles",
  welcomeConnect:
    "Depois conecte um player para que cada música que você tocar daqui em diante seja scrobblada no seu perfil. Spotify, players de computador e apps de celular funcionam.",
  welcomeConnectButton: "Conectar um player",
  welcomeFollow: "Siga amigos e encontre suas almas gêmeas musicais: as pessoas com o gosto mais parecido com o seu.",
  welcomeProfile: "Seu perfil: {url}",

  resetSubject: "Redefina sua senha do Sonosphere",
  resetHeading: "Redefina sua senha",
  resetBody: "Alguém (tomara que você) pediu para redefinir a senha de {username} no Sonosphere.",
  resetButton: "Escolher uma nova senha",
  resetNote:
    "O link vale por uma hora e só uma vez. Se você não pediu isso, ignore esta mensagem: sua senha continua a mesma.",

  changeSubject: "Confirme seu novo e-mail no Sonosphere",
  changeHeading: "Confirme seu novo e-mail",
  changeBody: "{username} no Sonosphere pediu para usar este endereço daqui em diante. Confirme para fazer a troca.",
  changeButton: "Confirmar novo e-mail",
  changeNote:
    "O link vale por 3 dias. Até ser usado, a conta mantém o endereço antigo. Se não foi você, ignore esta mensagem.",

  approveSubject: "Aprove a troca de e-mail no Sonosphere",
  approveHeading: "Aprovar troca de e-mail",
  approveBody:
    "{username} pediu para trocar o e-mail para {email}. Aprove aqui primeiro; depois enviaremos um link de verificação para o novo endereço.",
  approveButton: "Aprovar troca de e-mail",
  approveNote: "Este link vale por uma hora. Se você não pediu essa troca, não aprove e mude sua senha.",

  emailChangedSubject: "Seu e-mail do Sonosphere foi alterado",
  emailChangedHeading: "Seu e-mail foi alterado",
  emailChangedBody:
    "O e-mail de {username} no Sonosphere agora é {email}. Os e-mails sobre a conta vão para lá daqui em diante.",
  emailChangedWarning:
    "Se não foi você que fez essa alteração, outra pessoa pode estar com sua senha. Redefina-a na página de login e avise a equipe do site.",

  passwordChangedSubject: "Sua senha do Sonosphere foi alterada",
  passwordChangedHeading: "Sua senha foi alterada",
  passwordChangedBody:
    "A senha de {username} no Sonosphere acabou de ser alterada, e todos os outros dispositivos foram desconectados.",
  passwordSetSubject: "Você definiu uma senha no Sonosphere",
  passwordSetHeading: "Você definiu uma senha",
  passwordSetBody:
    "{username} no Sonosphere agora tem uma senha. Você pode entrar com ela e usá-la em apps de scrobble que pedem uma. Entrar pelos seus outros sites continua funcionando.",
  notYouReset: "Se não foi você, redefina sua senha agora mesmo na página de login.",
  resetPasswordButton: "Redefinir senha",

  digestSubjectDaily: "Seu dia no Sonosphere: {count} novidades",
  digestSubjectWeekly: "Sua semana no Sonosphere: {count} novidades",
  digestHeading: "Oi, {username}, veja o que você perdeu",
  digestMore: "E mais {count} na sua caixa de entrada.",
  digestMessages: { one: "{count} nova mensagem de {people}", other: "{count} novas mensagens de {people}" },
  digestPeople: { one: "{count} pessoa", other: "{count} pessoas" },
  openInbox: "Abrir caixa de entrada",

  followed: "{who} começou a te seguir",
  followedBySomeone: "Alguém começou a te seguir",
  seeProfile: "Ver o perfil",
  wallReply: "{who} respondeu ao seu recado no mural",
  wallReplyBySomeone: "Alguém respondeu ao seu recado no mural",
  wallPost: "{who} escreveu no seu mural",
  wallPostBySomeone: "Alguém escreveu no seu mural",
  seeWall: "Ver o mural",
  commented: "{who} comentou em “{title}”",
  commentedBySomeone: "Alguém comentou em “{title}”",
  commentedOnJournal: "{who} comentou no “seu post do diário”",
  commentedOnJournalBySomeone: "Alguém comentou no “seu post do diário”",
  seeComment: "Ver o comentário",
  messageRequest: "{from} te enviou um pedido de mensagem",
  seeRequest: "Ver o pedido",
  messageSent: "{from} te enviou uma mensagem",
  readIt: "Ler",
} satisfies Translation<typeof en>;

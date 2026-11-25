import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Aplicativos",
  account: "Conta",
  apiDocumentation: "Documentação da API",
  developers: "Desenvolvedores",
  onThisPage: "Nesta página",

  apiHeading: "API do Sonosphere",
  apiIntro:
    "A API segue o protocolo Last.fm 2.0, então a maioria dos códigos de scrobbler funciona só trocando a URL raiz. Só quer scrobblar de um player? Veja a {help}.",
  apiHelpLink: "ajuda com scrobbles",
  basics: "Noções básicas",
  rootUrl: "URL raiz:",
  basicsSend: "Envie {method}, {apiKey} e os parâmetros como query string (leituras) ou POST form-encoded (escritas).",
  basicsFormat: "Adicione {format} para JSON. XML é o padrão.",
  basicsKey: "Obtenha uma chave e um segredo compartilhado em {applications}.",
  authentication: "Autenticação",
  authWeb:
    "{label} envie o usuário para {url}. Ele volta com {token}; troque-o com {getSession} em até uma hora. Sem {cb}, é usado o callback salvo, e um {cb} informado precisa estar no mesmo site.",
  authWebLabel: "Web:",
  authDesktop: "{label} chame {getToken}, envie o usuário para {url} e depois chame {getSession}.",
  authDesktopLabel: "Desktop:",
  authScripts: "{label} faça POST em {getMobileSession} com {username} e {password}.",
  authScriptsLabel: "Scripts:",
  sessionKeys: "As chaves de sessão não expiram. As três chamadas são assinadas.",
  signing: "Assinatura",
  signingBody:
    "Ordene todos os parâmetros, exceto {format} e {callback}, pelo nome, junte-os como {pair}, acrescente seu segredo e envie o digest MD5 em hexadecimal como {apiSig}.",
  examples: "Exemplos",
  batch: "Scrobbles em lote usam parâmetros indexados ({artist}, {track}, …), até 50 por chamada.",
  errors: "Erros",
  errorsBody:
    "Falhas retornam {shape}: 3 método inválido, 4 falha na autenticação, 6 parâmetros inválidos, 9 sessão inválida, 10 chave de API inválida, 13 assinatura inválida, 14 token não autorizado.",
  lbHeading: "API do ListenBrainz",
  lbIntro:
    "A API do ListenBrainz é servida em {root} com os mesmos caminhos, corpos de requisição e respostas, então clientes e bibliotecas do ListenBrainz funcionam trocando a URL raiz para {origin}.",
  lbTokens:
    "{label} os usuários criam um em {applications}. Envie-o como {header}. Leituras não precisam de token, exceto para ver suas próprias reproduções privadas.",
  lbTokensLabel: "Tokens:",
  lbErrors: "{label} {shape} com o status HTTP correspondente. Estatísticas sem nada para mostrar retornam 204.",
  lbErrorsLabel: "Erros:",
  lbRateLimit: "{label} 100 requisições a cada 10 segundos por endereço, informadas nos cabeçalhos {header}.",
  lbRateLimitLabel: "Limite de requisições:",
  lbRecordingIds:
    "{label} os valores de {msid} são do próprio Sonosphere e só têm significado aqui. Um {mbid} passa a ser conhecido quando um cliente o envia com uma reprodução.",
  lbRecordingIdsLabel: "IDs de gravação:",
  lbStats: "{label} são em tempo real e usam UTC. Todos os intervalos são suportados, de {from} a {to}.",
  lbStatsLabel: "Estatísticas",
  lbSupported: "Endpoints suportados:",
  lbUnavailable: "Playlists, recomendações, rádio, consultas de metadados e dumps de dados não estão disponíveis.",
  npHeading: "API pública de “tocando agora”",
  npIntro:
    "Mostre a música atual de um ouvinte em um site. Sem chave, assinatura ou login, e requisições cross-origin são permitidas.",
  npSnapshot: "{endpoint}: um snapshot em JSON",
  npSse: "{endpoint}: Server-Sent Events",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} é {null} quando nada está tocando. {album} e {imageUrl} podem ser {null}.",
  npDuration:
    "{duration} é em segundos (0 se desconhecido). {startedAt} é o horário Unix da última atualização, não uma posição de reprodução.",
  npStreams:
    "Os streams enviam o estado atual ao conectar e depois um snapshot a cada mudança. Eventos passados não são reenviados.",
  npUnavailable:
    "Se as reproduções ficarem privadas ou a conta deixar de existir, os streams enviam {unavailable} e fecham. Não reconecte depois disso.",
  npPing: "Os WebSockets enviam {ping} a cada 15 segundos; não é preciso responder.",
  npErrors:
    "Erros: 400 nome inválido, 403 privado, 404 usuário desconhecido, 429 limite de requisições (com {retryAfter}).",
  npSpotify:
    "As reproduções do Spotify são verificadas mais ou menos uma vez por minuto, então as mudanças podem levar esse tempo para aparecer.",
  otherApis: "Outras APIs",
  otherApisLb: "API compatível com ListenBrainz",
  otherApisNp: "Snapshots de “tocando agora”, SSE e WebSockets",
  methods: "Métodos",
  groupLabel: "{group}:",
  groupAuth: "Autenticação",
  groupTrack: "Faixa",
  groupArtist: "Artista",
  groupAlbum: "Álbum",
  groupUser: "Usuário",
  groupTag: "Tag",
  groupChart: "Parada",
  groupListens: "Reproduções",
  groupFeedback: "Feedback",
  groupSocial: "Social",
  groupUserStats: "Estatísticas do usuário (GET stats/user/{user}/…)",
  groupSiteStats: "Estatísticas do site (GET stats/sitewide/…)",
  groupListeners: "Ouvintes",

  helpHeading: "Ajuda com scrobbles",
  helpIntro: "O Sonosphere registra as músicas que você ouve. Escolha a opção que combina com o seu jeito de ouvir.",
  helpSpotifyOpen: "Abra {applications}.",
  helpSpotifyFollow: "Siga os passos do Spotify lá para conectar sua conta.",
  helpSpotifyPlay:
    "Ouça música. As novas faixas aparecem em cerca de um minuto, e nada precisa ficar aberto no seu dispositivo.",
  helpPanoServer: "No Pano, escolha a opção de servidor personalizado compatível com Last.fm (GNU FM).",
  helpPanoFields: "Preencha os três campos:",
  helpPanoApiUrl: "URL da API:",
  helpPanoUsername: "{label} seu nome de usuário do Sonosphere",
  helpPanoUsernameLabel: "Nome de usuário:",
  helpPanoPassword: "{label} sua senha do Sonosphere",
  helpPanoPasswordLabel: "Senha:",
  helpPanoLogIn: "Entre. O Pano aparece em {applications}, onde você pode desconectá-lo quando quiser.",
  helpPanoNote:
    "Se cadastrou por outro serviço? Defina uma senha em {account} primeiro. Você não precisa de conta de API: o Pano usa sua chave e segredo embutidos {secret}.",
  helpListenBrainz: "Apps do ListenBrainz",
  helpLbIntro:
    "Players e scrobblers que suportam ListenBrainz (multi-scrobbler, Navidrome, plugins do Jellyfin, Pano e outros) podem enviar as reproduções para cá.",
  helpLbOpen: "Abra {applications} e escolha {button}. Copie o token: ele só aparece uma vez.",
  helpLbCreateToken: "Criar token do ListenBrainz",
  helpLbServer:
    "No app, defina o servidor ou a URL da API do ListenBrainz como {origin} e cole o token. Se o app pedir o endereço completo da API, use {full}.",
  helpLbPlay: "Ouça música. O token aparece em {applications}, onde você pode desconectá-lo quando quiser.",
  helpNavidromeConfig:
    "Na configuração do Navidrome, defina {option} (ou a variável de ambiente {env}) como {url} e reinicie o Navidrome.",
  helpNavidromeLink:
    "No Navidrome, abra suas configurações pessoais, ative o scrobbling para o ListenBrainz e cole o token.",
  helpNavidromeNote:
    "A URL base vale para todo o servidor Navidrome: quem ativar o scrobbling para o ListenBrainz enviará as reproduções para cá, cada um com seu próprio token.",
  helpJellyfinRepo: "No painel do Jellyfin, abra Plugins, depois a aba Repositórios, e adicione {repo}.",
  helpJellyfinInstall: "Instale o plugin ListenBrainz pelo catálogo e reinicie o Jellyfin.",
  helpJellyfinUrl: "Nas configurações do plugin, na aba General, defina {setting} como {url} e salve.",
  helpJellyfinUser: "Na aba User Config, escolha seu usuário, cole o token em {field}, marque {enable} e salve.",
  helpPlexIntro:
    "O Plex não consegue enviar reproduções para outro servidor sozinho, então rode o {app} ao lado dele para repassá-las.",
  helpPlexSource:
    "Adicione o Plex como fonte: defina {url} com o endereço do seu servidor Plex e {token} com seu token do Plex.",
  helpPlexClient:
    "Adicione um cliente ListenBrainz: defina {url} como {origin}, {token} com seu token e {user} com seu nome de usuário do Sonosphere.",
  helpPlexPlay: "Reinicie o multi-scrobbler e toque algo no Plex.",
  helpWebScrobblerIntro: "O Web Scrobbler é uma extensão de navegador que faz scrobbling a partir de sites de música.",
  helpWebScrobblerEdit: "Nas opções do Web Scrobbler, encontre o ListenBrainz entre as contas e edite as propriedades.",
  helpWebScrobblerFields: "Defina a URL da API como {url} e o token de usuário com seu token, e salve.",
  helpOtherApps: "Outros scrobblers",
  helpOtherIntro:
    "Qualquer player que suporte o protocolo Last.fm 2.0 e permita trocar o servidor pode scrobblar aqui.",
  helpOtherServerUrl: "URL do servidor:",
  helpOtherKey: "{label} se o app pedir, crie uma conta de API em {applications}.",
  helpOtherKeyLabel: "Chave e segredo da API:",
  helpOwnScrobbler: "Criando seu próprio scrobbler ou widget? Veja a {docs}.",
  helpManual: "Scrobbles manuais e importações",
  helpManualAdd: "Adicione reproduções manualmente na {scrobble}.",
  helpScrobblePage: "página de scrobble",
  helpManualImport: "Traga seu histórico usando {import}.",
  helpImportLink: "Importar histórico de reprodução",

  changelogHeading: "Novidades",
  changelogManage: "Gerenciar posts",
  changelogNew: "Novo post",
  changelogEdit: "Editar",
  changelogEmpty: "Nenhum post de novidades ainda.",
} satisfies Translation<typeof en>;

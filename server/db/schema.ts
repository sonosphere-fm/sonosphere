import { pgTable, integer, bigint, boolean, text, customType, primaryKey, index, uniqueIndex, unique, real, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const big = (name: string) => bigint(name, { mode: "number" });

// a real, cascading foreign key for one kind of a polymorphic type/id pair (a shout on an artist, a tag on a track)
const kindRef = (typeCol: string, idCol: string, kind: string, target: () => AnyPgColumn) =>
  integer(`${kind}_ref`)
    .generatedAlwaysAs(sql.raw(`CASE WHEN ${typeCol} = '${kind}' THEN ${idCol} END`))
    .references(target, { onDelete: "cascade" });
const kindIndexes = (table: string, cols: Record<string, AnyPgColumn>) =>
  Object.entries(cols).map(([k, c]) => index(`${table}_${k}_ref`).on(c).where(sql`${c} IS NOT NULL`));

// files live in object storage at `<key>.webp` and `<key>-s.webp`; `size` is both together in bytes
export const images = pgTable("images", {
	// random, so links to pictures cannot be counted through
	id: text().primaryKey().default(sql`replace(gen_random_uuid()::text, '-', '')`),
	mime: text().notNull(),
	data: bytea(),
	key: text(),
	// hotlinked from elsewhere (an artist photo on Spotify's servers) instead of our storage
	url: text(),
	size: integer().notNull().default(0),
	width: integer(),
	height: integer(),
	uploaderId: integer("uploader_id"),
	createdAt: integer("created_at").notNull(),
}, (table) => [
	index("images_uploader").on(table.uploaderId),
]);

export const users = pgTable("users", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	username: text().notNull(),
	usernameNorm: text("username_norm").notNull().unique(),
	email: text().notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	realname: text().default("").notNull(),
	pronouns: text().default("").notNull(),
	about: text().default("").notNull(),
	country: text().default("").notNull(),
	website: text().default("").notNull(),
	imageId: text("image_id").references(() => images.id, { onDelete: "set null" } ),
	hideRecent: boolean("hide_recent").default(false).notNull(),
	privateListening: boolean("private_listening").default(false).notNull(),
	shoutsEnabled: boolean("shouts_enabled").default(true).notNull(),
	registeredAt: integer("registered_at").notNull(),
	isAdmin: boolean("is_admin").default(false).notNull(),
	suspended: boolean().default(false).notNull(),
	role: text().default("user").notNull(),
	banned: boolean().default(false).notNull(),
	bannedAt: integer("banned_at"),
	banReason: text("ban_reason").default("").notNull(),
	dmPolicy: text("dm_policy").default("requests").notNull(),
	dmMuted: boolean("dm_muted").default(false).notNull(),
	emailVerifiedAt: integer("email_verified_at"),
	// "instant", "daily", "weekly" or "off"
	emailNotify: text("email_notify").default("instant").notNull(),
	// comma separated
	emailMuted: text("email_muted").default("").notNull(),
	// "light", "system" or "dark"
	theme: text().default("light").notNull(),
	digestAt: integer("digest_at"),
});

// kind: "verify", "change" (a new address, replaces users.email once confirmed) or "reset"
export const emailTokens = pgTable("email_tokens", {
	hash: text().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	kind: text().notNull(),
	email: text().notNull(),
	createdAt: integer("created_at").notNull(),
	expiresAt: integer("expires_at").notNull(),
}, t => [index("email_tokens_user").on(t.userId, t.kind)]);

export const outbox = pgTable("outbox", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	to: text().notNull(),
	subject: text().notNull(),
	text: text().notNull(),
	html: text().notNull(),
	attempts: integer().default(0).notNull(),
	nextAt: integer("next_at").notNull(),
	error: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
}, t => [index("outbox_next").on(t.nextAt)]);

export const oauthAccounts = pgTable("oauth_accounts", {
	provider: text().notNull(),
	subject: text().notNull(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	name: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.provider, table.subject], name: "oauth_accounts_provider_subject_pk" }),
	unique("oauth_accounts_user_provider").on(table.userId, table.provider),
]);

// tokens are stored as SHA-256 digests, so a copy of the database cannot be used to sign in
export const sessions = pgTable("sessions", {
	token: text().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
});

export const artists = pgTable("artists", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: text().notNull(),
	nameNorm: text("name_norm").notNull().unique(),
	imageId: text("image_id").references(() => images.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	baseListeners: big("base_listeners").default(0).notNull(),
	basePlaycount: big("base_playcount").default(0).notNull(),
	mbid: text(),
	spotifyId: text("spotify_id"),
	metaAt: integer("meta_at"),
	// Spotify is asked once, never again after a real answer
	spAt: integer("sp_at"),
	// Wikidata is asked again after a month: photos get added there
	wdAt: integer("wd_at"),
});

// artist pictures from a copy of Spotify's catalogue, loaded by hand and left out of backups
export const spotifyArtistPics = pgTable("spotify_artist_pics", {
	spotifyId: text("spotify_id").primaryKey(),
	nameNorm: text("name_norm").notNull(),
	followers: integer().notNull(),
	url: text().notNull(),
	width: integer(),
	height: integer(),
}, t => [index("spotify_artist_pics_name").on(t.nameNorm, t.followers)]);

export const albums = pgTable("albums", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	titleNorm: text("title_norm").notNull(),
	releaseDate: text("release_date"),
	imageId: text("image_id").references(() => images.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	baseListeners: big("base_listeners").default(0).notNull(),
	basePlaycount: big("base_playcount").default(0).notNull(),
	// the MusicBrainz release group
	mbid: text(),
	metaAt: integer("meta_at"),
	coverAt: integer("cover_at"),
	spAt: integer("sp_at"),
	lfAt: integer("lf_at"),
},
(table) => [
	unique().on(table.artistId, table.titleNorm),
]);

export const tracks = pgTable("tracks", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	titleNorm: text("title_norm").notNull(),
	duration: integer().default(0).notNull(),
	albumId: integer("album_id").references(() => albums.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	baseListeners: big("base_listeners").default(0).notNull(),
	basePlaycount: big("base_playcount").default(0).notNull(),
	metaAt: integer("meta_at"),
	spAt: integer("sp_at"),
	lfAt: integer("lf_at"),
},
(table) => [
	unique().on(table.artistId, table.titleNorm),
]);

export const albumTracks = pgTable("album_tracks", {
	albumId: integer("album_id").notNull().references(() => albums.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	position: integer().notNull(),
},
(table) => [
	primaryKey({ columns: [table.albumId, table.trackId], name: "album_tracks_album_id_track_id_pk"})
]);

export const scrobbles = pgTable("scrobbles", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	albumId: integer("album_id").references(() => albums.id, { onDelete: "set null" } ),
	playedAt: integer("played_at").notNull(),
	source: text().default("web").notNull(),
	// the names as the player sent them, so a correction or a merge never loses what was played
	sentArtist: text("sent_artist"),
	sentTrack: text("sent_track"),
	sentAlbum: text("sent_album"),
},
(table) => [
	index("scrobbles_user_artist").on(table.userId, table.artistId, table.playedAt),
	index("scrobbles_time").on(table.playedAt),
	index("scrobbles_album").on(table.albumId, table.playedAt),
	index("scrobbles_track").on(table.trackId, table.playedAt),
	index("scrobbles_artist").on(table.artistId, table.playedAt),
	index("scrobbles_user_time").on(table.userId, table.playedAt),
	unique().on(table.userId, table.trackId, table.playedAt),
]);

export const nowPlaying = pgTable("now_playing", {
	userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	albumId: integer("album_id"),
	startedAt: integer("started_at").notNull(),
	expiresAt: integer("expires_at").notNull(),
});

export const lovedTracks = pgTable("loved_tracks", {
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.userId, table.trackId], name: "loved_tracks_user_id_track_id_pk"})
]);

export const tags = pgTable("tags", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: text().notNull(),
	nameNorm: text("name_norm").notNull().unique(),
});

export const taggings = pgTable("taggings", {
	userId: integer("user_id").references(() => users.id, { onDelete: "cascade" } ),
	tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" } ),
	itemType: text("item_type").notNull(),
	itemId: integer("item_id").notNull(),
	createdAt: integer("created_at").notNull(),
	weight: integer().default(1).notNull(),
	artistRef: kindRef("item_type", "item_id", "artist", () => artists.id),
	albumRef: kindRef("item_type", "item_id", "album", () => albums.id),
	trackRef: kindRef("item_type", "item_id", "track", () => tracks.id),
},
(table) => [
	index("taggings_tag").on(table.tagId, table.itemType),
	index("taggings_item").on(table.itemType, table.itemId),
	uniqueIndex("taggings_unique").on(sql`COALESCE(${table.userId}, 0)`, table.tagId, table.itemType, table.itemId),
	...kindIndexes("taggings", { artist: table.artistRef, album: table.albumRef, track: table.trackRef }),
]);

export const wikis = pgTable("wikis", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	itemType: text("item_type").notNull(),
	itemId: integer("item_id").notNull(),
	content: text().notNull(),
	authorId: integer("author_id").references(() => users.id, { onDelete: "set null" } ),
	version: integer().notNull(),
	createdAt: integer("created_at").notNull(),
	artistRef: kindRef("item_type", "item_id", "artist", () => artists.id),
	albumRef: kindRef("item_type", "item_id", "album", () => albums.id),
	trackRef: kindRef("item_type", "item_id", "track", () => tracks.id),
	tagRef: kindRef("item_type", "item_id", "tag", () => tags.id),
},
(table) => [
	index("wikis_item").on(table.itemType, table.itemId, table.version),
	...kindIndexes("wikis", { artist: table.artistRef, album: table.albumRef, track: table.trackRef, tag: table.tagRef }),
]);

export const shouts = pgTable("shouts", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	targetType: text("target_type").notNull(),
	targetId: integer("target_id").notNull(),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
	artistRef: kindRef("target_type", "target_id", "artist", () => artists.id),
	albumRef: kindRef("target_type", "target_id", "album", () => albums.id),
	trackRef: kindRef("target_type", "target_id", "track", () => tracks.id),
	tagRef: kindRef("target_type", "target_id", "tag", () => tags.id),
	userRef: kindRef("target_type", "target_id", "user", (): AnyPgColumn => users.id),
	eventRef: kindRef("target_type", "target_id", "event", (): AnyPgColumn => events.id),
	journalRef: kindRef("target_type", "target_id", "journal", (): AnyPgColumn => journals.id),
},
(table) => [
	index("shouts_target").on(table.targetType, table.targetId, table.createdAt),
	...kindIndexes("shouts", { artist: table.artistRef, album: table.albumRef, track: table.trackRef, tag: table.tagRef, user: table.userRef, event: table.eventRef, journal: table.journalRef }),
]);

export const follows = pgTable("follows", {
	followerId: integer("follower_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	followeeId: integer("followee_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("follows_followee").on(table.followeeId),
	primaryKey({ columns: [table.followerId, table.followeeId], name: "follows_follower_id_followee_id_pk"})
]);

export const similarArtists = pgTable("similar_artists", {
	artistId: integer("artist_id").notNull(),
	similarId: integer("similar_id").notNull(),
	score: real().notNull(),
	source: text().default("computed").notNull(),
},
(table) => [
	primaryKey({ columns: [table.artistId, table.similarId], name: "similar_artists_artist_id_similar_id_pk"})
]);

export const meta = pgTable("meta", {
	key: text().primaryKey(),
	value: text().notNull(),
});

export const events = pgTable("events", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	title: text().notNull(),
	venue: text().notNull(),
	city: text().notNull(),
	country: text().notNull(),
	startsAt: integer("starts_at").notNull(),
	description: text().default("").notNull(),
	url: text().default("").notNull(),
	creatorId: integer("creator_id").references(() => users.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	// "user", "musicbrainz" or "ticketmaster"
	source: text().default("user").notNull(),
	sourceId: text("source_id"),
	lat: real(),
	lon: real(),
},
(table) => [
	uniqueIndex("events_source").on(table.source, table.sourceId),
	index("events_starts").on(table.startsAt),
]);

export const eventArtists = pgTable("event_artists", {
	eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" } ),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	position: integer().default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.eventId, table.artistId], name: "event_artists_event_id_artist_id_pk"})
]);

export const eventAttendance = pgTable("event_attendance", {
	eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	status: text().notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.eventId, table.userId], name: "event_attendance_event_id_user_id_pk"})
]);

export const playlists = pgTable("playlists", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	description: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const playlistTracks = pgTable("playlist_tracks", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	playlistId: integer("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	position: integer().notNull(),
	addedAt: integer("added_at").notNull(),
});

export const obsessions = pgTable("obsessions", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	comment: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const notifications = pgTable("notifications", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	type: text().notNull(),
	actorId: integer("actor_id").references(() => users.id, { onDelete: "cascade" } ),
	data: text().default("{}").notNull(),
	read: boolean().default(false).notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("notifications_user").on(table.userId, table.createdAt),
]);

export const apiApps = pgTable("api_apps", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	name: text().notNull(),
	description: text().default("").notNull(),
	apiKey: text("api_key").notNull().unique(),
	secret: text().notNull(),
	// empty when the app passes cb= each time
	callbackUrl: text("callback_url").default("").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const apiTokens = pgTable("api_tokens", {
	token: text().primaryKey(),
	appId: integer("app_id").notNull().references(() => apiApps.id, { onDelete: "cascade" } ),
	userId: integer("user_id").references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
});

// `token` and `key` hold digests too
export const apiSessions = pgTable("api_sessions", {
	key: text().primaryKey(),
	appId: integer("app_id").notNull().references(() => apiApps.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
	lastUsedAt: integer("last_used_at").default(0).notNull(),
});

export const videoCache = pgTable("video_cache", {
	key: text().primaryKey(),
	videoId: text("video_id"),
	fetchedAt: integer("fetched_at").notNull(),
});

export const blocks = pgTable("blocks", {
	blockerId: integer("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	blockedId: integer("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.blockerId, table.blockedId], name: "blocks_blocker_id_blocked_id_pk"})
]);

export const reports = pgTable("reports", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	reporterId: integer("reporter_id").references(() => users.id, { onDelete: "set null" } ),
	targetType: text("target_type").notNull(),
	targetId: integer("target_id").notNull(),
	reason: text().notNull(),
	detail: text().default("").notNull(),
	status: text().default("open").notNull(),
	outcome: text().default("").notNull(),
	snapshot: text().default("{}").notNull(),
	resolvedBy: integer("resolved_by").references(() => users.id, { onDelete: "set null" } ),
	resolvedAt: integer("resolved_at"),
	createdAt: integer("created_at").notNull(),
	resolutionNote: text("resolution_note").default("").notNull(),
},
(table) => [
	index("reports_status").on(table.status, table.createdAt),
]);

export const journals = pgTable("journals", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	index("journals_user").on(table.userId, table.createdAt),
]);

export const auditLog = pgTable("audit_log", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" } ),
	actorName: text("actor_name").default("").notNull(),
	action: text().notNull(),
	targetType: text("target_type").default("").notNull(),
	targetId: integer("target_id"),
	targetLabel: text("target_label").default("").notNull(),
	subjectId: integer("subject_id"),
	note: text().default("").notNull(),
	data: text().default("{}").notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("audit_subject").on(table.subjectId, table.createdAt),
	index("audit_time").on(table.createdAt),
]);

export const modNotes = pgTable("mod_notes", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	authorId: integer("author_id").references(() => users.id, { onDelete: "set null" } ),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("mod_notes_user").on(table.userId, table.createdAt),
]);

export const wikiLocks = pgTable("wiki_locks", {
	itemType: text("item_type").notNull(),
	itemId: integer("item_id").notNull(),
	lockedBy: integer("locked_by").references(() => users.id, { onDelete: "set null" } ),
	reason: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
	artistRef: kindRef("item_type", "item_id", "artist", () => artists.id),
	albumRef: kindRef("item_type", "item_id", "album", () => albums.id),
	trackRef: kindRef("item_type", "item_id", "track", () => tracks.id),
	tagRef: kindRef("item_type", "item_id", "tag", () => tags.id),
},
(table) => [
	primaryKey({ columns: [table.itemType, table.itemId], name: "wiki_locks_item_type_item_id_pk"}),
	...kindIndexes("wiki_locks", { artist: table.artistRef, album: table.albumRef, track: table.trackRef, tag: table.tagRef }),
]);

export const siteSettings = pgTable("site_settings", {
	key: text().primaryKey(),
	value: text().notNull(),
});

export const userArtists = pgTable("user_artists", {
	userId: integer("user_id").notNull(),
	artistId: integer("artist_id").notNull(),
	plays: integer().notNull(),
},
(table) => [
	index("user_artists_item").on(table.artistId, table.plays),
	index("user_artists_top").on(table.userId, table.plays),
	primaryKey({ columns: [table.userId, table.artistId], name: "user_artists_user_id_artist_id_pk"})
]);

export const userAlbums = pgTable("user_albums", {
	userId: integer("user_id").notNull(),
	albumId: integer("album_id").notNull(),
	plays: integer().notNull(),
},
(table) => [
	index("user_albums_item").on(table.albumId, table.plays),
	index("user_albums_top").on(table.userId, table.plays),
	primaryKey({ columns: [table.userId, table.albumId], name: "user_albums_user_id_album_id_pk"})
]);

export const userTracks = pgTable("user_tracks", {
	userId: integer("user_id").notNull(),
	trackId: integer("track_id").notNull(),
	plays: integer().notNull(),
},
(table) => [
	index("user_tracks_item").on(table.trackId, table.plays),
	index("user_tracks_top").on(table.userId, table.plays),
	primaryKey({ columns: [table.userId, table.trackId], name: "user_tracks_user_id_track_id_pk"})
]);

export const dmThreads = pgTable("dm_threads", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userLo: integer("user_lo").notNull().references(() => users.id, { onDelete: "cascade" } ),
	userHi: integer("user_hi").notNull().references(() => users.id, { onDelete: "cascade" } ),
	status: text().default("request").notNull(),
	requesterId: integer("requester_id").notNull(),
	createdAt: integer("created_at").notNull(),
	lastAt: integer("last_at").notNull(),
	loRead: integer("lo_read").default(0).notNull(),
	hiRead: integer("hi_read").default(0).notNull(),
	loCleared: integer("lo_cleared").default(0).notNull(),
	hiCleared: integer("hi_cleared").default(0).notNull(),
},
(table) => [
	index("dm_threads_hi").on(table.userHi, table.lastAt),
	index("dm_threads_lo").on(table.userLo, table.lastAt),
	unique().on(table.userLo, table.userHi),
]);

export const dmMessages = pgTable("dm_messages", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	threadId: integer("thread_id").notNull().references(() => dmThreads.id, { onDelete: "cascade" } ),
	senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
	deletedAt: integer("deleted_at"),
	deletedBy: integer("deleted_by"),
},
(table) => [
	index("dm_messages_sender").on(table.senderId, table.createdAt),
	index("dm_messages_thread").on(table.threadId, table.id),
]);

export const dmGroups = pgTable("dm_groups", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	title: text().default("").notNull(),
	ownerId: integer("owner_id").notNull().references(() => users.id),
	createdAt: integer("created_at").notNull(),
	lastAt: integer("last_at").notNull(),
});

// readId and clearedId are message ids; a new member's clearedId starts at the newest message, so history before
// they joined stays hidden from them.
export const dmGroupMembers = pgTable("dm_group_members", {
	groupId: integer("group_id").notNull().references(() => dmGroups.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	joinedAt: integer("joined_at").notNull(),
	readId: integer("read_id").default(0).notNull(),
	clearedId: integer("cleared_id").default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.groupId, table.userId] }),
	index("dm_group_members_user").on(table.userId),
]);

// A row with `event` set is a membership or title change, and its body is the line shown for it.
export const dmGroupMessages = pgTable("dm_group_messages", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	groupId: integer("group_id").notNull().references(() => dmGroups.id, { onDelete: "cascade" } ),
	senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	body: text().notNull(),
	event: text(),
	createdAt: integer("created_at").notNull(),
	deletedAt: integer("deleted_at"),
	deletedBy: integer("deleted_by"),
},
(table) => [
	index("dm_group_messages_group").on(table.groupId, table.id),
	index("dm_group_messages_sender").on(table.senderId, table.createdAt),
]);

export const dmFlags = pgTable("dm_flags", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	kind: text().notNull(),
	detail: text().default("").notNull(),
	sample: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
	resolvedAt: integer("resolved_at"),
	resolvedBy: integer("resolved_by"),
},
(table) => [
	index("dm_flags_open").on(table.resolvedAt, table.createdAt),
]);


export const tasteQueue = pgTable("taste_queue", {
	kind: text().notNull(), // "artist" or "user"
	id: integer().notNull(),
	queuedAt: integer("queued_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.kind, table.id] }),
	index("taste_queue_age").on(table.queuedAt),
]);

export const tasteNorms = pgTable("taste_norms", {
	kind: text().notNull(),
	id: integer().notNull(),
	norm: real().notNull(),
	computedAt: integer("computed_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.kind, table.id] }),
]);

export const userNeighbours = pgTable("user_neighbours", {
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	neighbourId: integer("neighbour_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	score: real().notNull(),
},
(table) => [
	primaryKey({ columns: [table.userId, table.neighbourId] }),
	index("user_neighbours_best").on(table.userId, table.score),
]);

export const tasteFactors = pgTable("taste_factors", {
	kind: text().notNull(), // "artist" or "user"
	id: integer().notNull(),
	vec: bytea().notNull(), // float32 values
},
(table) => [
	primaryKey({ columns: [table.kind, table.id] }),
]);

// tokens are sealed (server/spotify/seal.ts)
export const spotifyLinks = pgTable("spotify_links", {
	userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" } ),
	// each listener brings their own Spotify app: Spotify caps a development app at a handful of users
	clientId: text("client_id").notNull().default(""),
	spotifyId: text("spotify_id").notNull(),
	displayName: text("display_name").default("").notNull(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token").notNull(),
	expiresAt: integer("expires_at").notNull(),
	// played_at (ms) of the newest play already imported
	cursor: big("cursor").default(0).notNull(),
	recentAt: integer("recent_at").default(0).notNull(),
	playingAt: integer("playing_at").default(0).notNull(),
	importedAt: integer("imported_at"),
	imported: integer().default(0).notNull(),
	// set when Spotify refuses the link; polling stops until the listener reconnects
	broken: text(),
	// space separated
	scopes: text("scopes").default("").notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("spotify_links_due").on(table.recentAt),
]);

export const spotifyAuth = pgTable("spotify_auth", {
	state: text().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	verifier: text().notNull(),
	clientId: text("client_id").notNull().default(""),
	// where to return to when Spotify comes back through a relay
	origin: text().notNull().default(""),
	redirectUri: text("redirect_uri").notNull(),
	createdAt: integer("created_at").notNull(),
});

// kind: "scrobbles" or "loved" (from a file), or "lastfm" (read from a Last.fm profile).
// status: "uploading" (file chunks still arriving), "queued", "running", "done", "failed" or "cancelled".
// cursor: how many rows have been worked through (files), or Last.fm pages read in the current phase.
export const importJobs = pgTable("import_jobs", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	kind: text().notNull(),
	status: text().notNull(),
	lastfmUser: text("lastfm_user"),
	// Last.fm: "scrobbles" then "loved"; plays after `lastfmTo` are left out so pages don't shift while reading
	phase: text().default("scrobbles").notNull(),
	lastfmTo: integer("lastfm_to"),
	pages: integer().default(0).notNull(),
	cursor: integer().default(0).notNull(),
	total: integer().default(0).notNull(),
	done: integer().default(0).notNull(),
	accepted: integer().default(0).notNull(),
	failures: integer().default(0).notNull(),
	error: text(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	index("import_jobs_user").on(table.userId, table.createdAt),
	index("import_jobs_status").on(table.status),
]);

export const importChunks = pgTable("import_chunks", {
	jobId: integer("job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" } ),
	n: integer().notNull(),
	rows: text().notNull(),
},
(table) => [
	primaryKey({ columns: [table.jobId, table.n], name: "import_chunks_pk" }),
]);

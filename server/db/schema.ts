// The database schema. Every table the site uses is declared here; queries elsewhere are built from these definitions,
// so column names and types are checked by the compiler. Changes are applied with migrations (see server/db/migrate.ts).
import { sqliteTable, integer, text, blob, primaryKey, index, uniqueIndex, unique, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const images = sqliteTable("images", {
	id: integer().primaryKey(),
	mime: text().notNull(),
	data: blob().notNull(),
	uploaderId: integer("uploader_id"),
	createdAt: integer("created_at").notNull(),
});

export const users = sqliteTable("users", {
	id: integer().primaryKey(),
	username: text().notNull(),
	usernameNorm: text("username_norm").notNull().unique(),
	email: text().notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	realname: text().default("").notNull(),
	about: text().default("").notNull(),
	country: text().default("").notNull(),
	website: text().default("").notNull(),
	imageId: integer("image_id").references(() => images.id, { onDelete: "set null" } ),
	hideRecent: integer("hide_recent", { mode: "boolean" }).default(false).notNull(),
	shoutsEnabled: integer("shouts_enabled", { mode: "boolean" }).default(true).notNull(),
	registeredAt: integer("registered_at").notNull(),
	isAdmin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
	suspended: integer({ mode: "boolean" }).default(false).notNull(),
	role: text().default("user").notNull(),
	banned: integer({ mode: "boolean" }).default(false).notNull(),
	bannedAt: integer("banned_at"),
	banReason: text("ban_reason").default("").notNull(),
	dmPolicy: text("dm_policy").default("requests").notNull(),
	dmMuted: integer("dm_muted", { mode: "boolean" }).default(false).notNull(),
});

export const sessions = sqliteTable("sessions", {
	token: text().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
});

export const artists = sqliteTable("artists", {
	id: integer().primaryKey(),
	name: text().notNull(),
	nameNorm: text("name_norm").notNull().unique(),
	imageId: integer("image_id").references(() => images.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	baseListeners: integer("base_listeners").default(0).notNull(),
	basePlaycount: integer("base_playcount").default(0).notNull(),
});

export const albums = sqliteTable("albums", {
	id: integer().primaryKey(),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	titleNorm: text("title_norm").notNull(),
	releaseDate: text("release_date"),
	imageId: integer("image_id").references(() => images.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	baseListeners: integer("base_listeners").default(0).notNull(),
	basePlaycount: integer("base_playcount").default(0).notNull(),
},
(table) => [
	unique().on(table.artistId, table.titleNorm),
]);

export const tracks = sqliteTable("tracks", {
	id: integer().primaryKey(),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	titleNorm: text("title_norm").notNull(),
	duration: integer().default(0).notNull(),
	albumId: integer("album_id").references(() => albums.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
	baseListeners: integer("base_listeners").default(0).notNull(),
	basePlaycount: integer("base_playcount").default(0).notNull(),
},
(table) => [
	unique().on(table.artistId, table.titleNorm),
]);

export const albumTracks = sqliteTable("album_tracks", {
	albumId: integer("album_id").notNull().references(() => albums.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	position: integer().notNull(),
},
(table) => [
	primaryKey({ columns: [table.albumId, table.trackId], name: "album_tracks_album_id_track_id_pk"})
]);

export const scrobbles = sqliteTable("scrobbles", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	albumId: integer("album_id").references(() => albums.id, { onDelete: "set null" } ),
	playedAt: integer("played_at").notNull(),
	source: text().default("web").notNull(),
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

export const nowPlaying = sqliteTable("now_playing", {
	userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	albumId: integer("album_id"),
	startedAt: integer("started_at").notNull(),
	expiresAt: integer("expires_at").notNull(),
});

export const lovedTracks = sqliteTable("loved_tracks", {
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.userId, table.trackId], name: "loved_tracks_user_id_track_id_pk"})
]);

export const tags = sqliteTable("tags", {
	id: integer().primaryKey(),
	name: text().notNull(),
	nameNorm: text("name_norm").notNull().unique(),
});

export const taggings = sqliteTable("taggings", {
	userId: integer("user_id").references(() => users.id, { onDelete: "cascade" } ),
	tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" } ),
	itemType: text("item_type").notNull(),
	itemId: integer("item_id").notNull(),
	createdAt: integer("created_at").notNull(),
	weight: integer().default(1).notNull(),
},
(table) => [
	index("taggings_tag").on(table.tagId, table.itemType),
	index("taggings_item").on(table.itemType, table.itemId),
	uniqueIndex("taggings_unique").on(sql`COALESCE(${table.userId}, 0)`, table.tagId, table.itemType, table.itemId),
]);

export const wikis = sqliteTable("wikis", {
	id: integer().primaryKey(),
	itemType: text("item_type").notNull(),
	itemId: integer("item_id").notNull(),
	content: text().notNull(),
	authorId: integer("author_id").references(() => users.id, { onDelete: "set null" } ),
	version: integer().notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("wikis_item").on(table.itemType, table.itemId, table.version),
]);

export const shouts = sqliteTable("shouts", {
	id: integer().primaryKey(),
	authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	targetType: text("target_type").notNull(),
	targetId: integer("target_id").notNull(),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("shouts_target").on(table.targetType, table.targetId, table.createdAt),
]);

export const follows = sqliteTable("follows", {
	followerId: integer("follower_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	followeeId: integer("followee_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("follows_followee").on(table.followeeId),
	primaryKey({ columns: [table.followerId, table.followeeId], name: "follows_follower_id_followee_id_pk"})
]);

export const similarArtists = sqliteTable("similar_artists", {
	artistId: integer("artist_id").notNull(),
	similarId: integer("similar_id").notNull(),
	score: real().notNull(),
	source: text().default("computed").notNull(),
},
(table) => [
	primaryKey({ columns: [table.artistId, table.similarId], name: "similar_artists_artist_id_similar_id_pk"})
]);

export const meta = sqliteTable("meta", {
	key: text().primaryKey(),
	value: text().notNull(),
});

export const events = sqliteTable("events", {
	id: integer().primaryKey(),
	title: text().notNull(),
	venue: text().notNull(),
	city: text().notNull(),
	country: text().notNull(),
	startsAt: integer("starts_at").notNull(),
	description: text().default("").notNull(),
	url: text().default("").notNull(),
	creatorId: integer("creator_id").references(() => users.id, { onDelete: "set null" } ),
	createdAt: integer("created_at").notNull(),
});

export const eventArtists = sqliteTable("event_artists", {
	eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" } ),
	artistId: integer("artist_id").notNull().references(() => artists.id, { onDelete: "cascade" } ),
	position: integer().default(0).notNull(),
},
(table) => [
	primaryKey({ columns: [table.eventId, table.artistId], name: "event_artists_event_id_artist_id_pk"})
]);

export const eventAttendance = sqliteTable("event_attendance", {
	eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	status: text().notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.eventId, table.userId], name: "event_attendance_event_id_user_id_pk"})
]);

export const playlists = sqliteTable("playlists", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	description: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const playlistTracks = sqliteTable("playlist_tracks", {
	id: integer().primaryKey(),
	playlistId: integer("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	position: integer().notNull(),
	addedAt: integer("added_at").notNull(),
});

export const obsessions = sqliteTable("obsessions", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	trackId: integer("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" } ),
	comment: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	type: text().notNull(),
	actorId: integer("actor_id").references(() => users.id, { onDelete: "cascade" } ),
	data: text().default("{}").notNull(),
	read: integer({ mode: "boolean" }).default(false).notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("notifications_user").on(table.userId, table.createdAt),
]);

export const apiApps = sqliteTable("api_apps", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	name: text().notNull(),
	description: text().default("").notNull(),
	apiKey: text("api_key").notNull().unique(),
	secret: text().notNull(),
	createdAt: integer("created_at").notNull(),
});

export const apiTokens = sqliteTable("api_tokens", {
	token: text().primaryKey(),
	appId: integer("app_id").notNull().references(() => apiApps.id, { onDelete: "cascade" } ),
	userId: integer("user_id").references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
});

export const apiSessions = sqliteTable("api_sessions", {
	key: text().primaryKey(),
	appId: integer("app_id").notNull().references(() => apiApps.id, { onDelete: "cascade" } ),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
});

export const videoCache = sqliteTable("video_cache", {
	key: text().primaryKey(),
	videoId: text("video_id"),
	fetchedAt: integer("fetched_at").notNull(),
});

export const blocks = sqliteTable("blocks", {
	blockerId: integer("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	blockedId: integer("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.blockerId, table.blockedId], name: "blocks_blocker_id_blocked_id_pk"})
]);

export const reports = sqliteTable("reports", {
	id: integer().primaryKey(),
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

export const journals = sqliteTable("journals", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	title: text().notNull(),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	index("journals_user").on(table.userId, table.createdAt),
]);

export const auditLog = sqliteTable("audit_log", {
	id: integer().primaryKey(),
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

export const modNotes = sqliteTable("mod_notes", {
	id: integer().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	authorId: integer("author_id").references(() => users.id, { onDelete: "set null" } ),
	body: text().notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("mod_notes_user").on(table.userId, table.createdAt),
]);

export const wikiLocks = sqliteTable("wiki_locks", {
	itemType: text("item_type").notNull(),
	itemId: integer("item_id").notNull(),
	lockedBy: integer("locked_by").references(() => users.id, { onDelete: "set null" } ),
	reason: text().default("").notNull(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.itemType, table.itemId], name: "wiki_locks_item_type_item_id_pk"})
]);

export const siteSettings = sqliteTable("site_settings", {
	key: text().primaryKey(),
	value: text().notNull(),
});

export const userArtists = sqliteTable("user_artists", {
	userId: integer("user_id").notNull(),
	artistId: integer("artist_id").notNull(),
	plays: integer().notNull(),
},
(table) => [
	index("user_artists_item").on(table.artistId, table.plays),
	index("user_artists_top").on(table.userId, table.plays),
	primaryKey({ columns: [table.userId, table.artistId], name: "user_artists_user_id_artist_id_pk"})
]);

export const userAlbums = sqliteTable("user_albums", {
	userId: integer("user_id").notNull(),
	albumId: integer("album_id").notNull(),
	plays: integer().notNull(),
},
(table) => [
	index("user_albums_item").on(table.albumId, table.plays),
	index("user_albums_top").on(table.userId, table.plays),
	primaryKey({ columns: [table.userId, table.albumId], name: "user_albums_user_id_album_id_pk"})
]);

export const userTracks = sqliteTable("user_tracks", {
	userId: integer("user_id").notNull(),
	trackId: integer("track_id").notNull(),
	plays: integer().notNull(),
},
(table) => [
	index("user_tracks_item").on(table.trackId, table.plays),
	index("user_tracks_top").on(table.userId, table.plays),
	primaryKey({ columns: [table.userId, table.trackId], name: "user_tracks_user_id_track_id_pk"})
]);

export const dmThreads = sqliteTable("dm_threads", {
	id: integer().primaryKey(),
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

export const dmMessages = sqliteTable("dm_messages", {
	id: integer().primaryKey(),
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

export const dmFlags = sqliteTable("dm_flags", {
	id: integer().primaryKey(),
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


// ---------- taste: similar artists and listening neighbours, worked out in the background ----------
/** Artists and users whose listening changed and whose matches are due a refresh. */
export const tasteQueue = sqliteTable("taste_queue", {
	kind: text().notNull(), // "artist" or "user"
	id: integer().notNull(),
	queuedAt: integer("queued_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.kind, table.id] }),
	index("taste_queue_age").on(table.queuedAt),
]);

/** Length of each artist's listener vector (and each user's artist vector), needed to turn overlap into a 0-1 score. */
export const tasteNorms = sqliteTable("taste_norms", {
	kind: text().notNull(),
	id: integer().notNull(),
	norm: real().notNull(),
	computedAt: integer("computed_at").notNull(),
},
(table) => [
	primaryKey({ columns: [table.kind, table.id] }),
]);

export const userNeighbours = sqliteTable("user_neighbours", {
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	neighbourId: integer("neighbour_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	score: real().notNull(),
},
(table) => [
	primaryKey({ columns: [table.userId, table.neighbourId] }),
	index("user_neighbours_best").on(table.userId, table.score),
]);

/** A listener's linked Spotify account. Tokens are sealed (server/spotify/seal.ts), never stored in the clear. */
export const spotifyLinks = sqliteTable("spotify_links", {
	userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" } ),
	/** The listener's own Spotify app (each brings one: Spotify caps a development app at a handful of users). */
	clientId: text("client_id").notNull().default(""),
	spotifyId: text("spotify_id").notNull(),
	displayName: text("display_name").default("").notNull(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token").notNull(),
	expiresAt: integer("expires_at").notNull(),
	/** played_at (ms) of the newest play already imported: the next poll asks only for later ones */
	cursor: integer().default(0).notNull(),
	recentAt: integer("recent_at").default(0).notNull(),
	playingAt: integer("playing_at").default(0).notNull(),
	importedAt: integer("imported_at"),
	imported: integer().default(0).notNull(),
	/** set when Spotify refuses the link (revoked access): polling stops until the listener reconnects */
	broken: text(),
	createdAt: integer("created_at").notNull(),
},
(table) => [
	index("spotify_links_due").on(table.recentAt),
]);

/** A sign-in with Spotify in progress, between leaving for Spotify and coming back. Lives ten minutes. */
export const spotifyAuth = sqliteTable("spotify_auth", {
	state: text().primaryKey(),
	userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	verifier: text().notNull(),
	clientId: text("client_id").notNull().default(""),
	/** The site address the listener started from, to return to when Spotify comes back through a relay. */
	origin: text().notNull().default(""),
	redirectUri: text("redirect_uri").notNull(),
	createdAt: integer("created_at").notNull(),
});

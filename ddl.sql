-- bot.broadcasts definition

-- Drop table

-- DROP TABLE bot.broadcasts;

CREATE TABLE bot.broadcasts (
	id uuid NOT NULL,
	status text NOT NULL,
	metadata jsonb NULL,
	"content" jsonb NULL,
	decided_by text NULL,
	decided_at timestamp NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	thread_ts text NULL,
	CONSTRAINT broadcasts_pkey PRIMARY KEY (id),
	CONSTRAINT broadcasts_thread_ts_key UNIQUE (thread_ts)
);
CREATE INDEX idx_broadcasts_thread_ts_status ON bot.broadcasts USING btree (thread_ts, status);


-- bot.broadcast_messages definition

-- Drop table

-- DROP TABLE bot.broadcast_messages;

CREATE TABLE bot.broadcast_messages (
	id serial4 NOT NULL,
	broadcast_id uuid NOT NULL,
	recipient_id text NULL,
	channel_id text NULL,
	message_ts text NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT broadcast_messages_channel_message_key UNIQUE (channel_id, message_ts),
	CONSTRAINT broadcast_messages_pkey PRIMARY KEY (id),
	CONSTRAINT broadcast_messages_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES bot.broadcasts(id) ON DELETE CASCADE
);
CREATE INDEX idx_broadcast_messages_channel_message ON bot.broadcast_messages USING btree (channel_id, message_ts);


-- bot.broadcast_reactions definition

-- Drop table

-- DROP TABLE bot.broadcast_reactions;

CREATE TABLE bot.broadcast_reactions (
	id serial4 NOT NULL,
	broadcast_id uuid NOT NULL,
	recipient_id text NOT NULL,
	reaction text NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT broadcast_reactions_pkey PRIMARY KEY (id),
	CONSTRAINT broadcast_reactions_unique UNIQUE (broadcast_id, recipient_id, reaction),
	CONSTRAINT broadcast_reactions_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES bot.broadcasts(id) ON DELETE CASCADE
);


-- bot.broadcast_replies definition

-- Drop table

-- DROP TABLE bot.broadcast_replies;

CREATE TABLE bot.broadcast_replies (
	id serial4 NOT NULL,
	broadcast_id uuid NOT NULL,
	recipient_id text NOT NULL,
	message_ts text NULL,
	thread_ts text NULL,
	body text NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT broadcast_replies_message_ts_key UNIQUE (message_ts),
	CONSTRAINT broadcast_replies_pkey PRIMARY KEY (id),
	CONSTRAINT broadcast_replies_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES bot.broadcasts(id) ON DELETE CASCADE
);


-- bot.broadcast_responder_threads definition

-- Drop table

-- DROP TABLE bot.broadcast_responder_threads;

CREATE TABLE bot.broadcast_responder_threads (
	id serial4 NOT NULL,
	broadcast_id uuid NOT NULL,
	channel_id text NOT NULL,
	thread_ts text NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT broadcast_responder_threads_pkey PRIMARY KEY (id),
	CONSTRAINT unique_broadcast_responder_thread UNIQUE (broadcast_id),
	CONSTRAINT broadcast_responder_threads_broadcast_id_fkey FOREIGN KEY (broadcast_id) REFERENCES bot.broadcasts(id) ON DELETE CASCADE
);
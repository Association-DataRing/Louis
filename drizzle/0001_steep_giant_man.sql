CREATE TABLE "message_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1024),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category" text NOT NULL,
	"text" text NOT NULL,
	"source_message_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'auto' NOT NULL,
	"provider_key_id" uuid,
	"model_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret_pending" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "backup_codes" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "folder_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "text_format" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "enc_dek" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "dek_nonce" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "enc_extracted_text" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extracted_text_nonce" text;--> statement-breakpoint
ALTER TABLE "cabinet_settings" ADD COLUMN "retention_days" integer;--> statement-breakpoint
ALTER TABLE "pipeline_agents" ADD COLUMN "rag_scope" jsonb;--> statement-breakpoint
ALTER TABLE "pipeline_agents" ADD COLUMN "temperature" double precision;--> statement-breakpoint
ALTER TABLE "message_chunks" ADD CONSTRAINT "message_chunks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memories" ADD CONSTRAINT "project_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memories" ADD CONSTRAINT "project_memories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_memories" ADD CONSTRAINT "project_memories_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_settings" ADD CONSTRAINT "ocr_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_settings" ADD CONSTRAINT "ocr_settings_provider_key_id_provider_keys_id_fk" FOREIGN KEY ("provider_key_id") REFERENCES "public"."provider_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_chunks_embedding_idx" ON "message_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "message_chunks_message_idx" ON "message_chunks" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_chunks_fts_idx" ON "message_chunks" USING gin (to_tsvector('french', "content"));--> statement-breakpoint
CREATE INDEX "project_memories_project_idx" ON "project_memories" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_folder_id_document_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."document_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "document_folders_user_idx" ON "document_folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_folders_parent_idx" ON "document_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_folder_idx" ON "documents" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "documents_parent_idx" ON "documents" USING btree ("parent_document_id");--> statement-breakpoint
CREATE INDEX "document_chunks_fts_idx" ON "document_chunks" USING gin (to_tsvector('french', "content"));--> statement-breakpoint
CREATE INDEX "agent_runs_message_idx" ON "agent_runs" USING btree ("message_id");
import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const lessonNotes=sqliteTable('lesson_notes',{
  id:text('id').primaryKey(),content:text('content').notNull().default(''),important:text('important').notNull().default(''),
  revision:integer('revision').notNull().default(0),updatedAt:text('updated_at'),changeId:text('change_id')
});
export const noteRevisions=sqliteTable('note_revisions',{
  id:text('id').primaryKey(),noteId:text('note_id').notNull(),content:text('content').notNull(),important:text('important').notNull(),
  revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),writerHash:text('writer_hash').notNull()
},table=>[index('note_revision_history').on(table.noteId,table.revision),index('note_writer_updates').on(table.writerHash,table.updatedAt)]);

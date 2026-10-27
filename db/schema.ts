import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const lessonNotes=sqliteTable('lesson_notes',{
  id:text('id').primaryKey(),content:text('content').notNull().default(''),important:text('important').notNull().default(''),
  revision:integer('revision').notNull().default(0),updatedAt:text('updated_at'),changeId:text('change_id')
});
export const noteRevisions=sqliteTable('note_revisions',{
  id:text('id').primaryKey(),noteId:text('note_id').notNull(),content:text('content').notNull(),important:text('important').notNull(),
  revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull(),writerHash:text('writer_hash').notNull()
},table=>[index('note_revision_history').on(table.noteId,table.revision),index('note_writer_updates').on(table.writerHash,table.updatedAt)]);

export const analyticsDailyVisitors=sqliteTable('analytics_daily_visitors',{
  day:text('day').notNull(),visitor:text('visitor').notNull(),opens:integer('opens').notNull().default(0)
},table=>[index('analytics_day').on(table.day),uniqueIndex('analytics_visitor_day').on(table.day,table.visitor)]);

export const analyticsOpenEvents=sqliteTable('analytics_open_events',{
  id:text('id').primaryKey()
});

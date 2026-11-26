import { createContext, useContext } from 'react';
import { MAIN_CALENDAR } from '../../lib/calendars';

/** The calendar an editor page is working on (photos and QR links need it too). */
export const EditorCalendar = createContext<string>(MAIN_CALENDAR);
export const useEditorCalendar = () => useContext(EditorCalendar);

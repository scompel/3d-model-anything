import type { RoomModule } from '../packages/room-runtime/types';
import localRooms from 'virtual:local-rooms';
export const ROOMS: RoomModule[] = [
  ...localRooms.map(room => ({
    id: room.id, label: room.label, playgroundAvailable: false,
    build: async () => (await import('../packages/room-runtime/imported-room')).loadImportedRoom(room.url),
  })),
  {id:'office-v4', label:'Wes’s office', build:async () => (await import('./office-v4')).officeV4.build()},
];
export const roomById = (id:string|null) => ROOMS.find(r=>r.id===id) ?? ROOMS[0];
export type {BuiltRoom, RoomModule} from '../packages/room-runtime/types';

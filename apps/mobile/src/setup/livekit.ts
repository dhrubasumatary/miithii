import { registerGlobals } from '@livekit/react-native';

// LiveKit requires its WebRTC globals before any Room/session is constructed.
registerGlobals();

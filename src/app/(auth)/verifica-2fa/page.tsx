import { get2faSetup } from '../actions';
import TwoFaForm from './form';

export const dynamic = 'force-dynamic';

export default async function Verify2FA() {
  const setup = await get2faSetup();
  return <TwoFaForm enabled={setup.enabled} secret={setup.secret} uri={setup.uri} />;
}

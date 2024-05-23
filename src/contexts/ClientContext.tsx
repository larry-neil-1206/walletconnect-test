import Client from "@walletconnect/sign-client";
import { PairingTypes, SessionTypes } from "@walletconnect/types";
import { Web3Modal } from "@web3modal/standalone";
import { RELAYER_EVENTS } from "@walletconnect/core";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getAppMetadata, getSdkError } from "@walletconnect/utils";
import {
  DEFAULT_APP_METADATA,
  DEFAULT_LOGGER,
} from "../constants";
import { AccountBalances, apiGetAccountBalance } from "../helpers";
import {
  getOptionalNamespaces,
  getRequiredNamespaces,
} from "../helpers/namespaces";

/**
 * Types
 */
interface IContext {
  client: Client | undefined;
  session: SessionTypes.Struct | undefined;
  connect: (pairing?: { topic: string }) => Promise<void>;
  disconnect: () => Promise<void>;
  isInitializing: boolean;
  chains: string[];
  relayerRegion: string;
  pairings: PairingTypes.Struct[];
  accounts: string[];
  balances: AccountBalances;
  isFetchingBalances: boolean;
  setChains: any;
  setRelayerRegion: any;
  origin: string;
}

/**
 * Context
 */
export const ClientContext = createContext<IContext>({} as IContext);

/**
 * Web3Modal Config
 */
const web3Modal = new Web3Modal({
  projectId: "277895a3706b78ecee8939445d8707f4",
  themeMode: "light",
  walletConnectVersion: 2,
  themeVariables: {
    "--w3m-z-index": "300"
  }
});

/**
 * Provider
 */
export function ClientContextProvider({
  children,
}: {
  children: ReactNode | ReactNode[];
}) {
  const [client, setClient] = useState<Client>();
  const [pairings, setPairings] = useState<PairingTypes.Struct[]>([]);
  const [session, setSession] = useState<SessionTypes.Struct>();

  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const prevRelayerValue = useRef<string>("");

  const [balances, setBalances] = useState<AccountBalances>({});
  const [accounts, setAccounts] = useState<string[]>([]);
  const [chains, setChains] = useState<string[]>(['eip155:1']);
  const [relayerRegion, setRelayerRegion] = useState<string>(
    "wss://relay.walletconnect.com"
  );
  const [origin, setOrigin] = useState<string>(getAppMetadata().url);
  const reset = () => {
    setSession(undefined);
    setBalances({});
    setAccounts([]);
    setChains([]);
    setRelayerRegion("wss://relay.walletconnect.com");
  };

  const getAccountBalances = async (_accounts: string[]) => {
    setIsFetchingBalances(true);
    try {
      const arr = await Promise.all(
        _accounts.map(async (account) => {
          const [namespace, reference, address] = account.split(":");
          const chainId = `${namespace}:${reference}`;
          const assets = await apiGetAccountBalance(address, chainId);

          return { account, assets: [assets] };
        })
      );

      const balances: AccountBalances = {};
      arr.forEach(({ account, assets }) => {
        balances[account] = assets;
      });
      setBalances(balances);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingBalances(false);
    }
  };

  const onSessionConnected = useCallback(
    async (_session: SessionTypes.Struct) => {
      const allNamespaceAccounts = Object.values(_session.namespaces)
        .map((namespace) => namespace.accounts)
        .flat();
      const allNamespaceChains = Object.keys(_session.namespaces);

      setSession(_session);
      setChains(allNamespaceChains);
      setAccounts(allNamespaceAccounts);

      await getAccountBalances(allNamespaceAccounts);
    },
    []
  );

  const connect = useCallback(
    async (pairing: any) => {
      if (typeof client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }
      console.log("connect, pairing topic is:", chains, pairing?.topic);
      console.log("===> check the relayUrl", client?.opts);
      try {
        const requiredNamespaces = getRequiredNamespaces(chains);
        console.log(
          "requiredNamespaces config for connect:",
          requiredNamespaces
        );
        const optionalNamespaces = getOptionalNamespaces(chains);
        console.log(
          "optionalNamespaces config for connect:",
          optionalNamespaces
        );
        const { uri, approval } = await client.connect({
          pairingTopic: pairing?.topic,
          requiredNamespaces,
          optionalNamespaces,
        });
        console.error('===> client.connect passed', uri, approval)

        // Open QRCode modal if a URI was returned (i.e. we're not connecting an existing pairing).
        if (uri) {
          // Create a flat array of all requested chains across namespaces.
          const standaloneChains = Object.values(requiredNamespaces)
            .map((namespace) => namespace.chains)
            .flat() as string[];

          console.log('===> web3Modal.openModal', uri)
          console.log('===> standaloneChains', standaloneChains)
          web3Modal.openModal({ uri, standaloneChains });
        }
        console.log('===> awaiting approval')

        const session = await approval();
        console.log("Established session:", session);
        await onSessionConnected(session);
        // Update known pairings after session is connected.
        setPairings(client.pairing.getAll({ active: true }));
      } catch (e) {
        console.error(e);
        throw e;
      } finally {
        // close modal in case it was open
        web3Modal.closeModal();
      }
    },
    [chains, client, onSessionConnected]
  );

  const disconnect = useCallback(async () => {
    if (typeof client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof session === "undefined") {
      throw new Error("Session is not connected");
    }

    await client.disconnect({
      topic: session.topic,
      reason: getSdkError("USER_DISCONNECTED"),
    });

    // Reset app state after disconnect.
    reset();
  }, [client, session]);

  const _subscribeToEvents = useCallback(
    async (_client: Client) => {
      if (typeof _client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }

      _client.on("session_ping", (args) => {
        console.log("EVENT", "session_ping", args);
      });

      _client.on("session_event", (args) => {
        console.log("EVENT", "session_event", args);
      });

      _client.on("session_update", ({ topic, params }) => {
        console.log("EVENT", "session_update", { topic, params });
        const { namespaces } = params;
        const _session = _client.session.get(topic);
        const updatedSession = { ..._session, namespaces };
        onSessionConnected(updatedSession);
      });

      _client.on("session_delete", () => {
        console.log("EVENT", "session_delete");
        reset();
      });
    },
    [onSessionConnected]
  );

  const _checkPersistedState = useCallback(
    async (_client: Client) => {
      if (typeof _client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }
      // populates existing pairings to state
      setPairings(_client.pairing.getAll({ active: true }));
      console.log(
        "RESTORED PAIRINGS: ",
        _client.pairing.getAll({ active: true })
      );

      if (typeof session !== "undefined") return;
      // populates (the last) existing session to state
      if (_client.session.length) {
        const lastKeyIndex = _client.session.keys.length - 1;
        const _session = _client.session.get(
          _client.session.keys[lastKeyIndex]
        );
        console.log("RESTORED SESSION:", _session);
        await onSessionConnected(_session);
        return _session;
      }
    },
    [session, onSessionConnected]
  );

  const _logClientId = useCallback(async (_client: Client) => {
    if (typeof _client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    try {
      const clientId = await _client.core.crypto.getClientId();
      console.log("WalletConnect ClientID: ", clientId);
      localStorage.setItem("WALLETCONNECT_CLIENT_ID", clientId);
    } catch (error) {
      console.error(
        "Failed to set WalletConnect clientId in localStorage: ",
        error
      );
    }
  }, []);

  const createClient = useCallback(async () => {
    try {
      setIsInitializing(true);
      const claimedOrigin =
        localStorage.getItem("wallet_connect_dapp_origin") || origin;
      const _client = await Client.init({
        logger: DEFAULT_LOGGER,
        relayUrl: relayerRegion,
        projectId: "277895a3706b78ecee8939445d8707f4",
        metadata: {
          ...(getAppMetadata() || DEFAULT_APP_METADATA),
          url: claimedOrigin,
          verifyUrl: DEFAULT_APP_METADATA.verifyUrl,
        },
      });

      setClient(_client);
      setOrigin(_client.metadata.url);
      prevRelayerValue.current = relayerRegion;
      await _subscribeToEvents(_client);
      await _checkPersistedState(_client);
      await _logClientId(_client);
    } catch (err) {
      throw err;
    } finally {
      setIsInitializing(false);
    }
  }, [
    _checkPersistedState,
    _subscribeToEvents,
    _logClientId,
    relayerRegion,
    origin,
  ]);

  useEffect(() => {
    const claimedOrigin =
      localStorage.getItem("wallet_connect_dapp_origin") || origin;
    let interval: NodeJS.Timer;
    // simulates `UNKNOWN` validation by removing the verify iframe thus preventing POST message
    if (claimedOrigin === "unknown") {
      //The interval is needed as Verify tries to init new iframe(with different urls) multiple times
      interval = setInterval(
        () => document.getElementById("verify-api")?.remove(),
        500
      );
    }
    return () => {
      clearInterval(interval);
    };
  }, [origin]);

  useEffect(() => {
    if (!client) {
      console.log('===> createClient')
      createClient();
    } else if (
      prevRelayerValue.current &&
      prevRelayerValue.current !== relayerRegion
    ) {
      client.core.relayer.restartTransport(relayerRegion);
      prevRelayerValue.current = relayerRegion;
    }
  }, [createClient, relayerRegion, client]);

  useEffect(() => {
    if (!client) return;
    console.log('===> client valuable', client)

    client.core.relayer.on(RELAYER_EVENTS.connect, () => {
    });

    client.core.relayer.on(RELAYER_EVENTS.disconnect, () => {
    });
  }, [client]);

  const value = useMemo(
    () => ({
      pairings,
      isInitializing,
      balances,
      isFetchingBalances,
      accounts,
      chains,
      relayerRegion,
      client,
      session,
      connect,
      disconnect,
      setChains,
      setRelayerRegion,
      origin,
    }),
    [
      pairings,
      isInitializing,
      balances,
      isFetchingBalances,
      accounts,
      chains,
      relayerRegion,
      client,
      session,
      connect,
      disconnect,
      setChains,
      setRelayerRegion,
      origin,
    ]
  );

  return (
    <ClientContext.Provider
      value={{
        ...value,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useWalletConnectClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error(
      "useWalletConnectClient must be used within a ClientContextProvider"
    );
  }
  return context;
}

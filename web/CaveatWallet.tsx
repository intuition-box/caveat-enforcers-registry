import { useEffect, useState } from "react";
import {
  ConnectButton,
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { intuitionMainnet } from "@0xintuition/protocol";
import {
  createConfig,
  http,
  WagmiProvider,
  useAccount,
  useChainId,
} from "wagmi";
import { INTUITION_MAINNET_RPC } from "../src/ontology";
import { browserWalletFromProvider, type BrowserWallet } from "./wallet";

const walletConnectProjectId = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ""
).trim();

const browserWalletConnectors = connectorsForWallets(
  [{ groupName: "Browser wallets", wallets: [injectedWallet] }],
  {
    appName: "Caveat Registry",
    // The injected connector never contacts WalletConnect. This local label
    // only satisfies RainbowKit's shared connector factory in fallback mode.
    projectId: "caveat-injected-wallets",
  },
);

const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({
      appName: "Caveat Registry",
      appDescription:
        "Open registry for ERC-7710 caveat enforcers on Intuition.",
      appUrl:
        typeof window === "undefined" ? undefined : window.location.origin,
      projectId: walletConnectProjectId,
      chains: [intuitionMainnet],
      transports: { [intuitionMainnet.id]: http(INTUITION_MAINNET_RPC) },
    })
  : createConfig({
      chains: [intuitionMainnet],
      connectors: browserWalletConnectors,
      transports: { [intuitionMainnet.id]: http(INTUITION_MAINNET_RPC) },
      multiInjectedProviderDiscovery: true,
    });

const queryClient = new QueryClient();

export function CaveatWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={intuitionMainnet}
          modalSize="compact"
          theme={darkTheme({
            accentColor: "#ff6b3d",
            accentColorForeground: "#050505",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useCaveatWallet(): {
  wallet: BrowserWallet | null;
  error: string | null;
  connected: boolean;
  onIntuition: boolean;
} {
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWallet(null);
    setError(null);
    if (!isConnected || !address || !connector || chainId !== 1155) return;

    void connector
      .getProvider()
      .then((provider) => browserWalletFromProvider(provider, address))
      .then((nextWallet) => {
        if (!cancelled) setWallet(nextWallet);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The connected wallet could not be prepared.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, chainId, connector, isConnected]);

  return {
    wallet,
    error,
    connected: isConnected,
    onIntuition: chainId === 1155,
  };
}

export function CaveatConnectButton({
  disabled = false,
  compact = false,
}: {
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const label = !connected
          ? "Connect wallet"
          : chain.unsupported
            ? "Switch to Intuition"
            : compact
              ? account.displayName
              : `${account.displayName} · Intuition`;
        const onClick = !connected
          ? openConnectModal
          : chain.unsupported
            ? openChainModal
            : openAccountModal;

        return (
          <button
            className={`cta cta--solid web3-action web3-action--primary wallet-connect-cta ${
              connected && !chain.unsupported
                ? "wallet-connect-cta--connected"
                : "wallet-connect-cta--required"
            }`}
            type="button"
            onClick={onClick}
            disabled={disabled || !ready}
            aria-label={label}
          >
            {label} <span aria-hidden="true">→</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

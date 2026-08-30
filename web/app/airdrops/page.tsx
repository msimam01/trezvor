import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Gift, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";

// Mock data for airdrops
const airdrops = [
  {
    id: 1,
    name: "LayerZero",
    network: "Multi-chain",
    estimatedReward: "$500-$2,000",
    status: "live",
    requirements: ["Bridge assets", "Use dApps", "Provide liquidity"],
    joinLink: "https://layerzero.network",
    verified: true,
  },
  {
    id: 2,
    name: "Starknet",
    network: "Ethereum L2",
    estimatedReward: "$300-$1,500",
    status: "live",
    requirements: ["Deploy contracts", "Use bridge", "Interact with protocols"],
    joinLink: "https://starknet.io",
    verified: true,
  },
  {
    id: 3,
    name: "ZkSync",
    network: "Ethereum L2",
    estimatedReward: "$200-$800",
    status: "upcoming",
    requirements: ["Bridge assets", "Use dApps", "NFT minting"],
    joinLink: "https://zksync.io",
    verified: true,
  },
  {
    id: 4,
    name: "Scroll",
    network: "Ethereum L2",
    estimatedReward: "$100-$500",
    status: "live",
    requirements: ["Bridge tokens", "Use DeFi protocols", "NFT interactions"],
    joinLink: "https://scroll.io",
    verified: true,
  },
  {
    id: 5,
    name: "Linea",
    network: "Ethereum L2",
    estimatedReward: "$150-$600",
    status: "upcoming",
    requirements: ["Bridge assets", "Use swap", "NFT marketplace"],
    joinLink: "https://linea.build",
    verified: false,
  },
  {
    id: 6,
    name: "Base",
    network: "Coinbase L2",
    estimatedReward: "$50-$200",
    status: "live",
    requirements: ["Use Base bridge", "Interact with dApps", "Social actions"],
    joinLink: "https://base.org",
    verified: true,
  },
];

export default function AirdropsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-purple-600" />
            <span className="text-xl font-bold">GasBot Airdrops</span>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Web3 Airdrops Aggregator
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Discover and participate in verified cryptocurrency airdrops across multiple networks
            </p>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl">{airdrops.length}</CardTitle>
                <CardDescription>Total Airdrops</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl">
                  {airdrops.filter(a => a.status === "live").length}
                </CardTitle>
                <CardDescription>Currently Live</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-2xl">
                  {airdrops.filter(a => a.verified).length}
                </CardTitle>
                <CardDescription>Verified Projects</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Airdrops Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {airdrops.map((airdrop) => (
              <Card key={airdrop.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl">{airdrop.name}</CardTitle>
                    {airdrop.verified && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline">{airdrop.network}</Badge>
                    {airdrop.status === "live" ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Live
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Upcoming
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Estimated Reward
                      </p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {airdrop.estimatedReward}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Requirements
                      </p>
                      <ul className="space-y-1">
                        {airdrop.requirements.map((req, index) => (
                          <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                            <span className="text-purple-600">•</span>
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <a
                      href={airdrop.joinLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button className="w-full">
                        Join Airdrop
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Disclaimer */}
          <Card className="mt-12 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-5 w-5" />
                Disclaimer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Airdrops carry inherent risks. Always do your own research (DYOR) before participating. 
                Never share your private keys or seed phrases. GasBot provides information aggregation 
                services and is not responsible for the outcome of any airdrop participation. 
                Estimated rewards are based on historical data and may vary significantly.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>© 2024 GasBot. Airdrop information is provided for educational purposes.</p>
        </div>
      </footer>
    </div>
  );
}
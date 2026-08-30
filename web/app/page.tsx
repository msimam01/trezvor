import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Clock, ArrowRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">GasBot</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/airdrops" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Airdrops
            </a>
            <a href="/admin" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Admin
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Instant Micro-Gas Dispensing
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Get Gas Tokens Instantly
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Fast, secure micro-gas dispensing for Solana, Base, and TON blockchains. 
            Get started in seconds with our Telegram bot.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Zap className="mr-2 h-5 w-5" />
              Launch Telegram Bot
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>

        {/* Network Status */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                Solana
              </CardTitle>
              <CardDescription>SOL Network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-600">Operational</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Instant SOL transfers with low fees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Base
              </CardTitle>
              <CardDescription>Base Network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-600">Operational</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Fast ETH transfers on Coinbase L2
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyan-600" />
                TON
              </CardTitle>
              <CardDescription>TON Network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-yellow-600">High Load</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                TON transfers available (15-30 min delay)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-blue-600 dark:text-blue-300" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Get your gas tokens in under 5 minutes on most networks
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-purple-600 dark:text-purple-300" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Secure & Reliable</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Enterprise-grade security with automated liquidity monitoring
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-green-600 dark:text-green-300" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Micro Transactions</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Start with as little as ₦1,000 - perfect for testing and development
            </p>
          </div>
        </div>

        {/* Coming Soon Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 border-2 border-dashed">
          <CardHeader>
            <CardTitle className="text-2xl">Coming Soon</CardTitle>
            <CardDescription>Exciting features in development</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">Web App</Badge>
                <div>
                  <h4 className="font-semibold">Web Dashboard</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Full web interface for order management and analytics
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">API</Badge>
                <div>
                  <h4 className="font-semibold">Developer API</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    REST API for automated gas dispensing in your apps
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">Multi-chain</Badge>
                <div>
                  <h4 className="font-semibold">More Networks</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Support for Ethereum, Polygon, and other EVM chains
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="mt-1">Enterprise</Badge>
                <div>
                  <h4 className="font-semibold">Enterprise Features</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Bulk orders, API keys, and dedicated support
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>© 2024 GasBot. Built with Next.js, NestJS, and Telegram.</p>
        </div>
      </footer>
    </div>
  );
}
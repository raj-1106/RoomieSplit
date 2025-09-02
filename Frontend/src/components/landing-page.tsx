import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calculator, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LandingPage = () => {
  const { connected } = useWallet();
  const navigate = useNavigate();

  const features = [
    {
      icon: <Users className="h-8 w-8" />,
      title: "Create Groups",
      description: "Add friends by their Solana wallet addresses and start splitting expenses instantly."
    },
    {
      icon: <Calculator className="h-8 w-8" />,
      title: "Track Expenses",
      description: "Log shared expenses and automatically calculate who owes what to whom."
    },
    {
      icon: <Wallet className="h-8 w-8" />,
      title: "Solana Powered",
      description: "Built on Solana for fast, cheap transactions with full wallet integration."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg"></div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              RoomieSplit
            </h1>
          </div>
          <WalletMultiButton className="!bg-gradient-primary hover:!shadow-glow !transition-all !duration-300" />
        </header>

        {/* Hero Section */}
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Split Expenses with Friends
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The easiest way to split expenses on Solana. Create groups, add expenses, 
            and see who owes what in seconds.
          </p>
          
          {connected ? (
            <div className="space-x-4">
              <Button 
                variant="hero" 
                size="lg"
                onClick={() => {
                  console.log('Create group button clicked, navigating to /create-group');
                  navigate('/create-group');
                }}
                className="text-lg px-8 py-4 h-auto"
              >
                Create Your First Group
              </Button>
              <Button 
                variant="wallet" 
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="text-lg px-8 py-4 h-auto"
              >
                View Dashboard
              </Button>
            </div>
          ) : (
            <div className="bg-gradient-card backdrop-blur-sm rounded-lg p-6 border border-primary/20 max-w-md mx-auto">
              <p className="text-muted-foreground mb-4">Connect your Phantom wallet to get started</p>
              <WalletMultiButton className="!bg-gradient-primary hover:!shadow-glow !transition-all !duration-300 !w-full" />
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card hover:shadow-glow transition-all duration-300">
              <CardHeader>
                <div className="text-primary mb-4">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        {connected && (
          <div className="text-center bg-gradient-card backdrop-blur-sm rounded-xl p-8 border border-primary/20">
            <h3 className="text-2xl font-bold mb-4">Ready to start splitting?</h3>
            <p className="text-muted-foreground mb-6">
              Create your first group and invite friends to start tracking shared expenses.
            </p>
            <Button 
              variant="hero" 
              size="lg"
              onClick={() => {
                console.log('Get started button clicked, navigating to /create-group');
                navigate('/create-group');
              }}
            >
              Get Started Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

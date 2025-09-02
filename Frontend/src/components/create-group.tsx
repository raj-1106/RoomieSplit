import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useRoomiesplit } from '@/hooks/use-roomiesplit';
import { ArrowLeft, Plus, X, Users, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';

export const CreateGroup = () => {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { createGroup: createOnChainGroup } = useRoomiesplit();
  
  console.log('CreateGroup rendered, connected:', connected, 'publicKey:', publicKey?.toString());
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [memberAddress, setMemberAddress] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [useBlockchain, setUseBlockchain] = useState(false);

  const addMember = () => {
    if (!memberAddress.trim()) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Solana wallet address",
        variant: "destructive",
      });
      return;
    }

    // Basic validation for Solana address
    try {
      new PublicKey(memberAddress.trim());
    } catch {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Solana wallet address",
        variant: "destructive",
      });
      return;
    }

    if (members.includes(memberAddress.trim())) {
      toast({
        title: "Duplicate Address",
        description: "This address is already in the group",
        variant: "destructive",
      });
      return;
    }

    setMembers([...members, memberAddress.trim()]);
    setMemberAddress('');
  };

  const removeMember = (address: string) => {
    setMembers(members.filter(member => member !== address));
  };

  const createGroup = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!groupName.trim()) {
      toast({
        title: "Group Name Required",
        description: "Please enter a name for your group",
        variant: "destructive",
      });
      return;
    }

    if (members.length === 0) {
      toast({
        title: "Add Members",
        description: "Please add at least one member to the group",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    
    try {
      if (useBlockchain) {
        // Create group on-chain using Anchor
        const result = await createOnChainGroup(members);
        
        const groupData = {
          id: result.groupAddress.toString(),
          name: groupName,
          description: groupDescription,
          creator: publicKey.toString(),
          members: [publicKey.toString(), ...members],
          expenses: [],
          createdAt: new Date().toISOString(),
          isOnChain: true,
          groupAddress: result.groupAddress.toString(),
        };

        // Also store in localStorage for UI consistency
        const existingGroups = JSON.parse(localStorage.getItem('groups') || '[]');
        localStorage.setItem('groups', JSON.stringify([...existingGroups, groupData]));

        toast({
          title: "On-Chain Group Created!",
          description: `Successfully created "${groupName}" on Solana blockchain`,
        });
      } else {
        // Create mock group for testing
        const groupData = {
          id: Date.now().toString(),
          name: groupName,
          description: groupDescription,
          creator: publicKey.toString(),
          members: [publicKey.toString(), ...members],
          expenses: [],
          createdAt: new Date().toISOString(),
          isOnChain: false,
        };

        const existingGroups = JSON.parse(localStorage.getItem('groups') || '[]');
        localStorage.setItem('groups', JSON.stringify([...existingGroups, groupData]));

        toast({
          title: "Mock Group Created!",
          description: `Successfully created "${groupName}" with ${members.length + 1} members`,
        });
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: useBlockchain ? "Failed to create group on blockchain" : "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 max-w-md">
          <CardHeader>
            <CardTitle>Wallet Required</CardTitle>
            <CardDescription>
              Please connect your wallet to create a group
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="wallet" onClick={() => navigate('/')} className="w-full">
              Go Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Create New Group</h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Group Details
              </CardTitle>
              <CardDescription>
                Set up your expense-sharing group with friends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Blockchain Toggle */}
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center space-x-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <Label htmlFor="blockchain-toggle" className="font-medium">
                      Use Blockchain
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Create group on Solana blockchain (requires deployed contract)
                    </p>
                  </div>
                </div>
                <Switch
                  id="blockchain-toggle"
                  checked={useBlockchain}
                  onCheckedChange={setUseBlockchain}
                />
              </div>

              {/* Group Name */}
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name *</Label>
                <Input
                  id="groupName"
                  placeholder="e.g., Weekend Trip, Shared Apartment"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              {/* Group Description */}
              <div className="space-y-2">
                <Label htmlFor="groupDescription">Description (Optional)</Label>
                <Textarea
                  id="groupDescription"
                  placeholder="What is this group for?"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Add Members */}
              <div className="space-y-4">
                <Label>Group Members</Label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter Solana wallet address"
                    value={memberAddress}
                    onChange={(e) => setMemberAddress(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addMember()}
                  />
                  <Button onClick={addMember} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Current User */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">You</span>
                      <p className="text-sm text-muted-foreground">
                        {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
                      </p>
                    </div>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                      Creator
                    </span>
                  </div>
                </div>

                {/* Member List */}
                {members.map((member, index) => (
                  <div key={index} className="bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">Member {index + 1}</span>
                        <p className="text-sm text-muted-foreground">
                          {member.slice(0, 8)}...{member.slice(-8)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {members.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Add wallet addresses of friends you want to share expenses with
                  </p>
                )}
              </div>

              {/* Create Button */}
              <Button
                onClick={createGroup}
                disabled={isCreating || !groupName.trim() || members.length === 0}
                className="w-full"
                variant="hero"
                size="lg"
              >
                {isCreating 
                  ? (useBlockchain ? 'Creating On-Chain Group...' : 'Creating Group...') 
                  : (useBlockchain ? 'Create On-Chain Group' : 'Create Group')
                }
              </Button>

              {useBlockchain && (
                <p className="text-xs text-muted-foreground text-center">
                  This will create a group on the Solana blockchain using your deployed Anchor program
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
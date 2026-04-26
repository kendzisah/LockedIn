import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { MainStackParamList } from '../../../types/navigation';
import { GuildService, type MyGuildRow } from '../GuildService';
import GuildCard from '../components/GuildCard';
import EmptyGuildState from '../components/EmptyGuildState';
import HUDPanel from '../../home/components/HUDPanel';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';
import { SystemTokens } from '../../home/systemTokens';
import AppGuideSheet, { useAppGuide } from '../../../design/components/AppGuideSheet';

type StackNav = NativeStackNavigationProp<MainStackParamList>;

const GuildListScreen: React.FC = () => {
  const tabNav = useNavigation();
  const navigation = tabNav.getParent<StackNav>();
  const [guilds, setGuilds] = useState<MyGuildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const guildGuide = useAppGuide('guilds');
  const initialLoadDone = useRef(false);

  const fetchGuilds = useCallback(async () => {
    const data = await GuildService.getMyGuilds();
    setGuilds(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const run = async () => {
        if (!initialLoadDone.current) setLoading(true);
        const data = await GuildService.getMyGuilds();
        if (cancelled) return;
        setGuilds(data);
        initialLoadDone.current = true;
        setLoading(false);
      };
      void run();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGuilds();
    setRefreshing(false);
  }, [fetchGuilds]);

  if (loading) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#0A1628', '#0E1116', '#0E1116']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A1628', '#0E1116', '#0E1116']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerWrap}>
          <HUDPanel
            headerLabel="GUILD"
            headerRight={
              <TouchableOpacity
                onPress={() => navigation?.navigate('CreateGuild')}
                hitSlop={8}
                accessibilityLabel="Create guild"
                style={styles.addBtn}
              >
                <Ionicons name="add" size={18} color={Colors.primary} />
              </TouchableOpacity>
            }
          />
        </View>

        {guilds.length === 0 ? (
          <EmptyGuildState
            onCreateGuild={() => navigation?.navigate('CreateGuild')}
            onJoinGuild={() => navigation?.navigate('JoinGuild')}
          />
        ) : (
          <FlatList
            data={guilds}
            keyExtractor={(item) => item.guild_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <GuildCard
                guildName={item.name}
                memberCount={item.member_count}
                maxMembers={10}
                myRank={item.my_rank > 0 ? item.my_rank : null}
                myScore={item.my_score}
                topScore={item.top_score}
                onPress={() => navigation?.navigate('GuildDetail', { guild_id: item.guild_id })}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.primary}
              />
            }
          />
        )}

        {guilds.length > 0 && guilds.length < 5 && (
          <View style={styles.bottomAction}>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => navigation?.navigate('JoinGuild')}
              activeOpacity={0.85}
            >
              <Text style={styles.joinBtnText}>⟐  JOIN A GUILD</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <AppGuideSheet
        {...guildGuide}
        title="Guilds"
        subtitle="Stay accountable with friends."
        tips={[
          { icon: 'shield-outline', iconColor: Colors.primary, text: 'Create or join a guild of up to 10 people to compete together.' },
          { icon: 'trophy-outline', iconColor: '#FFC857', text: 'Leaderboards rank members by focus session minutes.' },
          { icon: 'add-circle-outline', iconColor: Colors.accent, text: 'Tap + to create your own guild or join an existing one with a code.' },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  headerWrap: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  addBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  listContent: {
    paddingBottom: 140,
    gap: 12,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    paddingBottom: 100,
    paddingTop: 12,
  },
  joinBtn: {
    backgroundColor: 'rgba(58,102,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.35)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinBtnText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: SystemTokens.glowAccent,
  },
});

export default GuildListScreen;

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
import { CrewService, type MyCrewRow } from '../CrewService';
import CrewCard from '../components/CrewCard';
import EmptyCrewState from '../components/EmptyCrewState';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

type StackNav = NativeStackNavigationProp<MainStackParamList>;

const CrewListScreen: React.FC = () => {
  const tabNav = useNavigation();
  const navigation = tabNav.getParent<StackNav>();
  const [crews, setCrews] = useState<MyCrewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadDone = useRef(false);

  const fetchCrews = useCallback(async () => {
    const data = await CrewService.getMyCrews();
    setCrews(data);
  }, []);

  // Refetch whenever the Crews tab gains focus (create/join/leave/detail all use stack modals).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const run = async () => {
        if (!initialLoadDone.current) {
          setLoading(true);
        }
        const data = await CrewService.getMyCrews();
        if (cancelled) return;
        setCrews(data);
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
    await fetchCrews();
    setRefreshing(false);
  }, [fetchCrews]);

  if (loading) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={['#0E1116', '#111922', '#0E1116']}
          locations={[0, 0.5, 1]}
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
        colors={['#0E1116', '#111922', '#0E1116']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowOrb} />
      <View style={styles.glowOrb2} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Crews</Text>
            <View style={styles.titleAccent}>
              <LinearGradient
                colors={[Colors.primary, Colors.accent]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.titleAccentFill}
              />
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation?.navigate('CreateCrew')}
            hitSlop={10}
            accessibilityLabel="Create crew"
            style={styles.addBtn}
          >
            <Ionicons name="add" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {crews.length === 0 ? (
          <EmptyCrewState
            onCreateCrew={() => navigation?.navigate('CreateCrew')}
            onJoinCrew={() => navigation?.navigate('JoinCrew')}
          />
        ) : (
          <FlatList
            data={crews}
            keyExtractor={(item) => item.crew_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <CrewCard
                crewName={item.name}
                memberCount={item.member_count}
                maxMembers={10}
                myRank={item.my_rank > 0 ? item.my_rank : null}
                myScore={item.my_score}
                topScore={item.top_score}
                onPress={() => navigation?.navigate('CrewDetail', { crew_id: item.crew_id })}
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

        {/* Join button */}
        {crews.length > 0 && crews.length < 5 && (
          <View style={styles.bottomAction}>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => navigation?.navigate('JoinCrew')}
              activeOpacity={0.85}
            >
              <Ionicons name="enter-outline" size={18} color={Colors.accent} />
              <Text style={styles.joinBtnText}>Join a Crew</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
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
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowOrb: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(58,102,255,0.06)',
  },
  glowOrb2: {
    position: 'absolute',
    top: 300,
    left: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,194,255,0.04)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  titleAccent: {
    marginTop: 8,
    height: 3,
    width: 40,
    borderRadius: 2,
    overflow: 'hidden',
  },
  titleAccentFill: {
    flex: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(58,102,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 12,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(21,26,33,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  joinBtnText: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
    color: Colors.accent,
  },
});

export default CrewListScreen;

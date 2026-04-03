import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
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

  const fetchCrews = useCallback(async () => {
    const data = await CrewService.getMyCrews();
    setCrews(data);
  }, []);

  useEffect(() => {
    fetchCrews().finally(() => setLoading(false));
  }, [fetchCrews]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCrews();
    setRefreshing(false);
  }, [fetchCrews]);

  const ownedCount = crews.length; // simplified — real count would check role

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Crews</Text>
        <TouchableOpacity
          onPress={() => navigation?.navigate('CreateCrew')}
          hitSlop={10}
          accessibilityLabel="Create crew"
        >
          <Ionicons name="add" size={28} color={Colors.primary} />
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 12,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(21,26,33,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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

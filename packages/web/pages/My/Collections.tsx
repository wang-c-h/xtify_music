import { css, cx } from '@emotion/css'
import useUserArtists from '@/web/api/hooks/useUserArtists'
import Tabs from '@/web/components/Tabs'
import { useMemo, useRef } from 'react'
import CoverRow from '@/web/components/CoverRow'
import useUserPlaylists from '@/web/api/hooks/useUserPlaylists'
import useUserAlbums from '@/web/api/hooks/useUserAlbums'
import { useSnapshot } from 'valtio'
import uiStates from '@/web/states/uiStates'
import ArtistRow from '@/web/components/ArtistRow'
import { playerWidth, topbarHeight } from '@/web/utils/const'
import topbarBackground from '@/web/assets/images/topbar-background.png'
import useIntersectionObserver from '@/web/hooks/useIntersectionObserver'
import { AnimatePresence, motion } from 'framer-motion'
import { scrollToBottom } from '@/web/utils/common'
import { sampleSize, throttle } from 'lodash-es'
import { useTranslation } from 'react-i18next'
import VideoRow from '@/web/components/VideoRow'
import useUserVideos from '@/web/api/hooks/useUserVideos'
import persistedUiStates from '@/web/states/persistedUiStates'
import settings from '@/web/states/settings'
import useUser from '@/web/api/hooks/useUser'
import Daily from './Daily'
import Cloud from './Cloud'
import Icon from '@/web/components/Icon'
import FileUploader from '@/web/components/Tools/Upload'
import CoverWall from '@/web/components/CoverWall'
import { IconNames } from '@/web/components/Icon/iconNamesType'

const collections = ['daily', 'playlists', 'albums', 'artists', 'videos', 'cloud'] as const
type Collection = typeof collections[number]

interface DiscoverPlayList {
  id: number
  coverUrl: string
  large: boolean
}

const Albums = () => {
  const { data: albums } = useUserAlbums()

  return <CoverRow albums={albums?.data} itemTitle='name' itemSubtitle='artist' />
}

const Playlists = () => {
  const user = useUser()
  const { data: playlists } = useUserPlaylists()
  const myPlaylists = useMemo(
    () => playlists?.playlist?.slice(1).filter(p => p.userId === user?.data?.account?.id),
    [playlists, user]
  )
  const otherPlaylists = useMemo(
    () => playlists?.playlist?.slice(1).filter(p => p.userId !== user?.data?.account?.id),
    [playlists, user]
  )
  const buildPlaylists = (playlists: Playlist[] | undefined): DiscoverPlayList[] => {
    // 从歌单中抽出歌曲
    const pickedIds: number[] = []
    const playLists: DiscoverPlayList[] = []
    playlists?.forEach(p => {
      if (pickedIds.includes(p.id)) return
      pickedIds.push(p.id)
      playLists.push({
        id: p.id,
        coverUrl: p.coverImgUrl as string,
        large: false,
      })
    })

    // 挑选出大图
    if (playlists) {
      const largeCover = sampleSize([...Array(playlists.length).keys()], ~~(playlists.length / 3))
      playLists.map((album, index) => (album.large = largeCover.includes(index)))
    }
    return playLists
  }
  const myCoverplayLists = buildPlaylists(myPlaylists)
  const othersCoverplayLists = buildPlaylists(otherPlaylists)

  return (
    <div>
      {/* My playlists */}
      {myPlaylists && (
        <>
          <div className='mb-4 mt-2 text-14 font-medium uppercase text-neutral-400'>
            Created BY ME
          </div>
          <CoverWall playlists={myCoverplayLists || []} />
        </>
      )}
      {/* Other playlists */}
      {otherPlaylists && (
        <>
          <div className='mb-4 mt-8 text-14 font-medium uppercase text-neutral-400'>
            Created BY OTHERS
          </div>
          <CoverWall playlists={othersCoverplayLists || []} />
        </>
      )}
    </div>
  )
}

const Artists = () => {
  const { data: artists } = useUserArtists()
  return <ArtistRow artists={artists?.data || []} />
}

const Videos = () => {
  const { data: videos } = useUserVideos()
  return <VideoRow videos={videos?.data || []} />
}

const CollectionTabs = ({ showBg }: { showBg: boolean }) => {
  const { t } = useTranslation()
  const { displayPlaylistsFromNeteaseMusic } = useSnapshot(settings)

  const tabs: { id: Collection; name: string; iconName?: IconNames }[] = [
    {
      id: 'daily',
      name: t`common.daily`,
      iconName: 'netease',
    },
    {
      id: 'albums',
      name: t`common.album_other`,
      iconName: 'album',
    },
    {
      id: 'playlists',
      name: t`common.playlist_other`,
      iconName: 'playlist',
    },
    {
      id: 'artists',
      name: t`common.artist_other`,
      iconName: 'artist',
    },
    {
      id: 'videos',
      name: t`common.video_other`,
      iconName: 'video',
    },
    {
      id: 'cloud',
      name: t`common.cloud`,
      iconName: 'cloud',
    },
  ]

  const { librarySelectedTab: selectedTab } = useSnapshot(persistedUiStates)
  const { minimizePlayer } = useSnapshot(persistedUiStates)
  const setSelectedTab = (id: Collection) => {
    persistedUiStates.librarySelectedTab = id
  }

  return (
    <div className='relative'>
      {/* Topbar background */}
      <AnimatePresence>
        {showBg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cx(
              'pointer-events-none absolute right-0 left-0 z-10',
              css`
                height: 230px;
                background-repeat: repeat;
              `
            )}
            style={{
              top: '-132px',
              // backgroundImage: `url(${topbarBackground})`,
            }}
          ></motion.div>
        )}
      </AnimatePresence>
      <div className='flex flex-row justify-between'>
        <Tabs
          tabs={tabs.filter(tab => {
            if (!displayPlaylistsFromNeteaseMusic && tab.id === 'playlists') {
              return false
            }
            return true
          })}
          value={selectedTab}
          onChange={(id: Collection) => {
            setSelectedTab(id)
          }}
          className={cx(
            'sticky',
            'z-10',
            // '-mb-10',
            'px-2.5 lg:px-0'
          )}
          style={{
            top: `${topbarHeight}px`,
          }}
        />
        <div className='items-center '>{/* {selectedTab == 'cloud' && <FileUploader/> } */}</div>
      </div>
    </div>
  )
}

const Collections = () => {
  const { librarySelectedTab: selectedTab } = useSnapshot(persistedUiStates)

  const observePoint = useRef<HTMLDivElement | null>(null)
  const { onScreen: isScrollReachBottom } = useIntersectionObserver(observePoint)

  const onScroll = throttle(() => {
    if (isScrollReachBottom) return
    scrollToBottom(true)
  }, 500)

  return (
    <motion.div>
      <CollectionTabs showBg={isScrollReachBottom} />
      <div
        className={cx('no-scrollbar overflow-y-auto px-2.5 pt-10 pb-16 lg:px-0')}
        onScroll={onScroll}
      >
        {selectedTab === 'daily' && <Daily />}
        {selectedTab === 'albums' && <Albums />}
        {selectedTab === 'playlists' && <Playlists />}
        {selectedTab === 'artists' && <Artists />}
        {selectedTab === 'videos' && <Videos />}
        {selectedTab === 'cloud' && <Cloud />}
      </div>
      <div ref={observePoint}></div>
    </motion.div>
  )
}

export default Collections

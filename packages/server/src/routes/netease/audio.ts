import { FastifyInstance, FastifyRequest } from 'fastify'
import NeteaseCloudMusicApi, { SoundQualityType } from 'NeteaseCloudMusicApi'
import log from '../../utils/log'
import cache from '../../utils/cache'
import fs from 'fs'
import { db, Tables } from '../../utils/db'
import pkg from '../../../../../package.json'

log.info('[server] appServer/routes/netease/audio.ts')

export const getAudioFromCache = async (id: number) => {
  // get from cache
  const cache = await db.find(Tables.Audio, id)
  if (!cache) return

  const audioFileName = `${cache.id}-${cache.bitRate}.${cache.format}`

  const isAudioFileExists = fs.existsSync(`${pkg.name}/audio_cache/${audioFileName}`)
  if (!isAudioFileExists) return

  log.debug(`[server] Audio cache hit ${id}`)

  return {
    data: [
      {
        source: cache.source,
        id: cache.id,
        url: `http://127.0.0.1:${
          process.env.ELECTRON_WEB_SERVER_PORT
        }/${pkg.name.toLowerCase()}/audio/${audioFileName}`,
        br: cache.bitRate,
        size: 0,
        md5: '',
        code: 200,
        expi: 0,
        type: cache.format,
        gain: 0,
        fee: 8,
        uf: null,
        payed: 0,
        flag: 4,
        canExtend: false,
        freeTrialInfo: null,
        level: 'standard',
        encodeType: cache.format,
        freeTrialPrivilege: {
          resConsumable: false,
          userConsumable: false,
          listenType: null,
        },
        freeTimeTrialPrivilege: {
          resConsumable: false,
          userConsumable: false,
          type: 0,
          remainTime: 0,
        },
        urlSource: 0,
      },
    ],
    code: 200,
  }
}

// const getAudioFromYouTube = async (id: number) => {
//   let fetchTrackResult: FetchTracksResponse | undefined = await cache.get(CacheAPIs.Track, {
//     ids: String(id),
//   })
//   if (!fetchTrackResult) {
//     log.info(`[audio] getAudioFromYouTube no fetchTrackResult, fetch from netease api`)
//     fetchTrackResult = (await NeteaseCloudMusicApi.song_detail({
//       ids: String(id),
//     })) as unknown as FetchTracksResponse
//   }
//   const track = fetchTrackResult?.songs?.[0]
//   if (!track) return

//   try {
//     const data = await youtube.matchTrack(track.ar[0].name, track.name)
//     if (!data) return
//     return {
//       data: [
//         {
//           source: 'youtube',
//           id,
//           url: data.url,
//           br: data.bitRate,
//           size: 0,
//           md5: '',
//           code: 200,
//           expi: 0,
//           type: 'opus',
//           gain: 0,
//           fee: 8,
//           uf: null,
//           payed: 0,
//           flag: 4,
//           canExtend: false,
//           freeTrialInfo: null,
//           level: 'standard',
//           encodeType: 'opus',
//           freeTrialPrivilege: {
//             resConsumable: false,
//             userConsumable: false,
//             listenType: null,
//           },
//           freeTimeTrialPrivilege: {
//             resConsumable: false,
//             userConsumable: false,
//             type: 0,
//             remainTime: 0,
//           },
//           urlSource: 0,
//           r3play: {
//             youtube: data,
//           },
//         },
//       ],
//       code: 200,
//     }
//   } catch (e) {
//     log.error('getAudioFromYouTube error', id, e)
//   }
// }
function stringifyCookie(cookies: string | string[] | undefined) {
  if(!cookies) return 
  var result = ''
  for (var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i]
    var separatorIndex = cookie.indexOf('=')
    var name = cookie.substring(0, separatorIndex)
    var value = cookie.substring(separatorIndex + 1)
    result += name + '=' + value + '; '
  }

  return result
}

async function audio(fastify: FastifyInstance) {
  // 劫持网易云的song/url api，将url替换成缓存的音频文件url
  fastify.get(
    '/netease/song/url/v1',
    async (
      req: FastifyRequest<{ Querystring: { id: string | number; level: SoundQualityType } }>,
      reply
    ) => {
      const id = Number(req.query.id) || 0
      if (!id || isNaN(id)) {
        return reply.status(400).send({
          code: 400,
          msg: 'id is required or id is invalid',
        })
      }

      const cache = await getAudioFromCache(id)
      if (cache) {
        return cache
      }
      log.info("[server] cookie ",req.headers.cookies)

      const { body: fromNetease }: { body: any } = await NeteaseCloudMusicApi.song_url_v1({
        ...req.query,
        cookie: stringifyCookie(req.headers.cookies),
      })
      if (
        fromNetease?.code === 200 &&
        !fromNetease?.data?.[0]?.freeTrialInfo &&
        fromNetease?.data?.[0]?.url
      ) {
        reply.status(200).send(fromNetease)
        return
      }


      // 是试听歌曲就把url删掉
      if (fromNetease?.data?.[0].freeTrialInfo) {
        fromNetease.data[0].url = ''
      }

      reply.status(fromNetease?.code ?? 500).send(fromNetease)
    }
  )

  // 获取缓存的音频数据
  fastify.get(
    `/${pkg.name.toLowerCase()}/audio/:filename`,
    (req: FastifyRequest<{ Params: { filename: string } }>, reply) => {
      const filename = req.params.filename
      cache.getAudio(filename, reply)
    }
  )

  // 缓存音频数据
  fastify.post(
    `/${pkg.name.toLowerCase()}/audio/:id`,
    async (
      req: FastifyRequest<{
        Params: { id: string }
        Querystring: { url: string; bitrate: number }
      }>,
      reply
    ) => {
      const id = Number(req.params.id)
      const { url, bitrate } = req.query
      if (isNaN(id)) {
        return reply.status(400).send({ error: 'Invalid param id' })
      }
      if (!url) {
        return reply.status(400).send({ error: 'Invalid query url' })
      }

      const data = await (req as any).file()

      if (!data?.file) {
        return reply.status(400).send({ error: 'No file' })
      }

      try {
        await cache.setAudio(await data.toBuffer(), { id, url, bitrate })
        reply.status(200).send('Audio cached!')
      } catch (error) {
        reply.status(500).send({ error })
      }
    }
  )
}

export default audio
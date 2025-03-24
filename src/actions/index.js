import { fetchDblpPapers, fetchPaperCitations } from '../api'
import * as ActionTypes from '../constants'

function makeActionCreator(type, ...argNames) {
  return (...args) => {
    const action = { type }
    action.payload = {}

    argNames.forEach((argName, index) => {
      action.payload[argNames[index]] = args[index]
    })

    return action
  }
}

export const filterVenue = makeActionCreator(ActionTypes.FILTER_VENUE, 'venues')
export const filterYear = makeActionCreator(ActionTypes.FILTER_YEAR, 'year')

const requestData = makeActionCreator(ActionTypes.REQUEST_DATA, 'query')
const receiveData = makeActionCreator(ActionTypes.RECEIVE_DATA, 'items')
const requestError = makeActionCreator(ActionTypes.REQUEST_ERROR, 'error')

export function fetchData(keyword) {
  return async (dispatch, getState) => {
    const venues = getState().filter.venues
    dispatch(requestData(venues))
    // 分离正向关键词和否定关键词
    const keywords = keyword.split(' ')
    const positiveKeywords = keywords.filter(k => !k.startsWith('!')).join(' ')
    const negativeKeywords = keywords
      .filter(k => k.startsWith('!'))
      .map(k => k.slice(1).toLowerCase()) // 只取感叹号后的单个词
    console.warn('搜索关键词解析:', {
      原始关键词: keyword,
      正向关键词: positiveKeywords,
      否定关键词: negativeKeywords,
    })
    // 使用正向关键词进行搜索
    const papers = await fetchDblpPapers(positiveKeywords, venues)
    if (!papers)
      dispatch(requestError(new Error('Bad Request')))
    console.warn('DBLP初始搜索结果:', {
      论文数量: papers.length,
      第一篇标题: papers[0]?.title,
    })

    // 过滤掉包含否定关键词的论文（使用子字符串匹配）
    const filteredPapers = negativeKeywords.length > 0
      ? papers.filter((paper) => {
          const paperText = `${paper.title} ${paper.abstract || ''} ${paper.keywords || ''}`.toLowerCase()
          const matchedWord = negativeKeywords.find(negKw => paperText.includes(negKw))
          if (matchedWord) {
            console.warn('过滤掉的论文:', {
              标题: paper.title,
              匹配到的否定词: matchedWord,
              匹配位置文本: paperText.substring(
                Math.max(0, paperText.indexOf(matchedWord) - 20),
                Math.min(paperText.length, paperText.indexOf(matchedWord) + matchedWord.length + 20),
              ),
            })
          }
          return !matchedWord
        })
      : papers

    console.warn('过滤后的结果:', {
      过滤前数量: papers.length,
      过滤后数量: filteredPapers.length,
      过滤掉数量: papers.length - filteredPapers.length,
    })

    const paperCitations = await fetchPaperCitations(filteredPapers)

    const papersDataWithCitations = filteredPapers.map((paper, index) => ({
      ...paper,
      citations: paperCitations[index],
    }))

    setTimeout(() => {
      dispatch(receiveData(papersDataWithCitations))
    }, 255)
  }
}

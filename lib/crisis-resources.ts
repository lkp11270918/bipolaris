export interface CrisisResource {
  id: string
  country: string
  province?: string
  city?: string
  name: string
  phone: string
  hours: string
  audience?: string
  operator?: string
  notes?: string
  featured?: boolean
}

export const crisisResources: CrisisResource[] = [
  {
    id: "cn-120",
    country: "中国",
    province: "全国",
    name: "急救电话",
    phone: "120",
    hours: "24小时",
    audience: "存在立即危险或医疗急症的人",
    featured: true,
  },
  {
    id: "cn-12356",
    country: "中国",
    province: "全国",
    name: "全国心理援助热线电话",
    phone: "12356",
    hours: "24小时",
    audience: "所有有心理需要的人",
    operator: "国家及各地卫健委",
    featured: true,
  },
  {
    id: "cn-hope24",
    country: "中国",
    province: "全国",
    name: "全国希望24小时热线",
    phone: "400-161-9995",
    hours: "24小时",
    operator: "中国科学院大学心理健康教育中心",
    notes: "学生专线按1，抑郁专线按2，生命热线按3",
    featured: true,
  },
  {
    id: "cn-12338",
    country: "中国",
    province: "全国",
    name: "妇女维权公益热线",
    phone: "12338",
    hours: "8:00 - 23:00",
    audience: "女性及儿童",
    operator: "全国妇联",
    notes: "维权服务时间为24小时",
  },
  {
    id: "cn-qinghua",
    country: "中国",
    province: "全国",
    name: "清华幸福公益心理服务热线",
    phone: "400-010-0525",
    hours: "非节假日 10:00 - 22:00",
    operator: "清华大学心理学系、幸福公益",
  },
  {
    id: "cn-csu",
    country: "中国",
    province: "湖南",
    city: "长沙",
    name: "长沙市心理援助热线",
    phone: "0731-85501010",
    hours: "24小时",
    operator: "长沙市第九医院",
  },
  {
    id: "cn-shenzhen",
    country: "中国",
    province: "广东",
    city: "深圳",
    name: "深圳市心理援助和危机干预热线",
    phone: "0755-25629459",
    hours: "24小时",
    operator: "深圳市精神卫生中心",
  },
  {
    id: "cn-zhejiang",
    country: "中国",
    province: "浙江",
    name: "浙江省统一心理援助热线",
    phone: "96525",
    hours: "24小时",
    notes: "手机拨打可用 010-82951332",
  },
  {
    id: "cn-shanghai-962525",
    country: "中国",
    province: "上海",
    city: "上海",
    name: "上海市心理热线",
    phone: "021-962525",
    hours: "24小时",
    operator: "上海市卫生健康委员会",
    notes: "接通体验和等待时间可能因时段而异",
  },
  {
    id: "cn-beijing",
    country: "中国",
    province: "北京",
    city: "北京",
    name: "心理危机研究与干预中心热线",
    phone: "010-82951332",
    hours: "24小时",
    operator: "北京心理危机研究与干预中心",
    notes: "接通时间取决于人流量，等待时间可上10分钟",
  },
  {
    id: "us-nyc-well",
    country: "美国",
    city: "New York",
    name: "NYC Well",
    phone: "1-888-692-9355",
    hours: "24小时",
    notes: "中文转5；短信编辑 WELL 发送至 65173",
  },
  {
    id: "ie-helpline",
    country: "爱尔兰",
    province: "全国",
    name: "24-Hour Crisis Helpline",
    phone: "1800 247 247",
    hours: "24小时",
    notes: "短信发送 HELP 至 51444",
  },
  {
    id: "ca-suicide",
    country: "加拿大",
    province: "全国",
    name: "全国自杀危机求助热线",
    phone: "40033",
    hours: "24小时",
    notes: "电话或短信",
  },
  {
    id: "ca-kids-help-phone",
    country: "加拿大",
    province: "全国",
    name: "Kids Help Phone",
    phone: "1-800-668-6868",
    hours: "24小时",
    audience: "20岁以下儿童",
    notes: "发送短信 CONNECT 至 686868",
  },
  {
    id: "ca-bc-310",
    country: "加拿大",
    province: "不列颠哥伦比亚省",
    name: "BC 心理健康与危机应对热线",
    phone: "310-6789",
    hours: "24小时",
    notes: "心理健康支持热线，无需区号",
  },
]

export const featuredCrisisResources = crisisResources.filter((resource) => resource.featured)

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`
}

// 404.
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'

export default function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center page-enter">
      <img src={import.meta.env.BASE_URL + 'images/illustrations/not-found.svg'} alt="" className="h-32 w-32" />
      <h1 className="mt-6 type-h1 text-text-pri">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 type-body text-text-sec">입력한 주소에 해당하는 화면이 없어요. 주소를 확인해 주세요.</p>
      <div className="mt-8">
        <Button as={Link} to="/" size="lg">지도 화면</Button>
      </div>
    </div>
  )
}

"use client"

import { supabase } from "@/integrations/supabase/client"
import { useState, useEffect } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Avatar, AvatarImage, AvatarFallback } from "./avatar"
import { User, UploadCloud, Loader2 } from "lucide-react"
import { showError } from "@/utils/toast"

type ImageUploadProps = {
  bucket: string
  url: string | null | undefined
  onUpload: (url: string) => void
}

export function ImageUpload({ bucket, url, onUpload }: ImageUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(url)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setAvatarUrl(url)
  }, [url])

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("Você deve selecionar uma imagem para enviar.")
      }

      const file = event.target.files[0]
      const fileExt = file.name.split(".").pop()
      const filePath = `${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      if (!data.publicUrl) {
        throw new Error("Não foi possível obter a URL pública da imagem.")
      }
      
      onUpload(data.publicUrl)
      setAvatarUrl(data.publicUrl)
    } catch (error: any) {
      showError(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg">
      <Avatar className="h-32 w-32">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback>
          <User className="h-16 w-16 text-gray-400" />
        </AvatarFallback>
      </Avatar>
      <div>
        <Button asChild variant="outline">
          <label htmlFor="single" className="cursor-pointer">
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4 mr-2" />
                Enviar Arquivo
              </>
            )}
          </label>
        </Button>
        <Input
          style={{
            visibility: "hidden",
            position: "absolute",
          }}
          type="file"
          id="single"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={uploading}
        />
      </div>
    </div>
  )
}
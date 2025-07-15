import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface HelpTextProps {
  title: string
  content: string
  className?: string
  compact?: boolean
}

const HelpText: React.FC<HelpTextProps> = ({ 
  title, 
  content, 
  className = '',
  compact = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={`${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center space-x-2 text-gray-400 hover:text-gray-300 transition-colors duration-200 ${
          compact ? 'text-xs' : 'text-sm'
        }`}
        aria-expanded={isExpanded}
        aria-controls="help-content"
      >
        <HelpCircle className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
        <span className="font-medium">{title}</span>
        {isExpanded ? (
          <ChevronUp className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
        ) : (
          <ChevronDown className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} flex-shrink-0`} />
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id="help-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`text-gray-400 leading-relaxed ${
              compact ? 'text-xs mt-1 pl-5' : 'text-sm mt-2 pl-6'
            }`}>
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default HelpText